#include <jni.h>
#include <llama.h>
#include <algorithm>
#include <atomic>
#include <cstring>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

// Una inferencia por proceso: llama.cpp consume memoria significativa en móvil.
static std::mutex g_inference_mutex;
// Un toque en Cancelar desde Java interrumpe la generación de forma cooperativa.
// No se mata el hilo JNI ni se libera memoria mientras llama.cpp la usa.
static std::atomic_bool g_cancel_requested{false};
// Mantener pesos del modelo en el proceso y reutilizarlos entre mensajes.
// Cada solicitud crea un contexto KV independiente; no se comparte la sesión
// del usuario con otros procesos ni con servidores.
static bool g_backend_initialized = false;
static std::unique_ptr<llama_model, decltype(&llama_model_free)>
    g_model_cache(nullptr, llama_model_free);
static std::string g_model_path;

static jbyteArray to_java(JNIEnv * env, const std::string & text) {
    jbyteArray result = env->NewByteArray(static_cast<jsize>(text.size()));
    if (result && !text.empty()) {
        env->SetByteArrayRegion(result, 0, static_cast<jsize>(text.size()),
                                reinterpret_cast<const jbyte *>(text.data()));
    }
    return result;
}

static std::string infer(const std::string & path, const std::string & question, int max_tokens) {
    if (g_cancel_requested.load(std::memory_order_relaxed)) return "ERROR: Generación cancelada.";
    if (!g_backend_initialized) {
        llama_backend_init();
        g_backend_initialized = true;
    }
    if (!g_model_cache || g_model_path != path) {
        g_model_cache.reset(llama_model_load_from_file(
            path.c_str(), llama_model_default_params()));
        if (!g_model_cache) return "ERROR: No se pudo cargar el archivo GGUF.";
        g_model_path = path;
    }
    if (g_cancel_requested.load(std::memory_order_relaxed)) return "ERROR: Generación cancelada.";
    llama_model * model = g_model_cache.get();
    const llama_vocab * vocab = llama_model_get_vocab(model);
    if (!vocab) return "ERROR: El modelo no tiene un vocabulario válido.";

    const std::string system =
        "Eres My Teacher IA, un tutor de secundaria. Responde en español. "
        "Guía mediante preguntas y pistas progresivas; no reveles directamente "
        "la solución completa de una tarea. Sé respetuoso y conciso.";
    const std::string user = question + "\n/no_think";
    const llama_chat_message messages[] = {
        { "system", system.c_str() }, { "user", user.c_str() }
    };
    const char * tmpl = llama_model_chat_template(model, nullptr);
    if (!tmpl) return "ERROR: El GGUF no contiene una plantilla de conversación.";
    int size = static_cast<int>((system.size() + user.size() + 512) * 3);
    std::vector<char> prompt_buffer(size, 0);
    int needed = llama_chat_apply_template(tmpl, messages, 2, true,
                                           prompt_buffer.data(), size);
    if (needed <= 0) return "ERROR: La plantilla del modelo no es compatible.";
    if (needed >= size) {
        prompt_buffer.resize(static_cast<size_t>(needed) + 1);
        needed = llama_chat_apply_template(tmpl, messages, 2, true,
                                           prompt_buffer.data(),
                                           static_cast<int>(prompt_buffer.size()));
        if (needed <= 0 || needed >= static_cast<int>(prompt_buffer.size())) {
            return "ERROR: No se pudo preparar la conversación.";
        }
    }
    // Qwen3 tiene modo de razonamiento interno. Con pocas fichas de
    // salida, puede gastar TODO el presupuesto en <think> y mostrar vacío.
    // El prefill de cierre para Qwen3 desactiva el razonamiento visible y
    // empieza directamente la respuesta educativa, sin cambiar de modelo.
    // Solo se utiliza con el GGUF Qwen3 controlado por esta aplicación.
    std::string prompt(prompt_buffer.data(), static_cast<size_t>(needed));
    const std::string no_think_prefill = "<think>\n\n</think>\n";
    prompt += no_think_prefill;
    int token_count = llama_tokenize(vocab, prompt.c_str(),
        static_cast<int>(prompt.size()), nullptr, 0, true, true);
    if (token_count >= 0) return "ERROR: No se pudo medir la entrada.";
    std::vector<llama_token> tokens(static_cast<size_t>(-token_count));
    token_count = llama_tokenize(vocab, prompt.c_str(),
        static_cast<int>(prompt.size()), tokens.data(),
        static_cast<int>(tokens.size()), true, true);
    if (token_count <= 0) return "ERROR: No se pudo convertir la pregunta en tokens.";
    tokens.resize(static_cast<size_t>(token_count));

    auto params = llama_context_default_params();
    params.n_ctx = 2048;
    params.n_batch = 256;
    params.n_ubatch = 128;
    params.n_threads = 4;
    params.n_threads_batch = 4;
    if (token_count + max_tokens >= static_cast<int>(params.n_ctx)) {
        return "ERROR: La pregunta es demasiado extensa para este teléfono.";
    }
    auto context = std::unique_ptr<llama_context, decltype(&llama_free)>(
        llama_init_from_model(model, params), llama_free);
    if (!context) return "ERROR: Memoria insuficiente para iniciar la IA.";

    for (size_t index = 0; index < tokens.size(); index += 256) {
        if (g_cancel_requested.load(std::memory_order_relaxed)) return "ERROR: Generación cancelada.";
        const int amount = static_cast<int>(std::min<size_t>(256, tokens.size() - index));
        if (llama_decode(context.get(), llama_batch_get_one(tokens.data() + index, amount)) < 0) {
            return "ERROR: Falló el procesamiento de la pregunta.";
        }
    }

    auto sampler = std::unique_ptr<llama_sampler, decltype(&llama_sampler_free)>(
        llama_sampler_init_greedy(), llama_sampler_free);
    if (!sampler) return "ERROR: No se pudo inicializar el generador.";

    std::string answer;
    for (int i = 0; i < max_tokens; ++i) {
        if (g_cancel_requested.load(std::memory_order_relaxed)) return "ERROR: Generación cancelada.";
        const llama_token next = llama_sampler_sample(sampler.get(), context.get(), -1);
        if (llama_vocab_is_eog(vocab, next)) break;
        char small[512];
        int n = llama_token_to_piece(vocab, next, small, sizeof(small), 0, false);
        if (n < 0) {
            std::vector<char> large(static_cast<size_t>(-n) + 1);
            n = llama_token_to_piece(vocab, next, large.data(),
                                     static_cast<int>(large.size()), 0, false);
            if (n > 0) answer.append(large.data(), static_cast<size_t>(n));
        } else if (n > 0) {
            answer.append(small, static_cast<size_t>(n));
        }
        if (i + 1 < max_tokens) {
            llama_token next_token = next;
            if (llama_decode(context.get(), llama_batch_get_one(&next_token, 1)) < 0) {
                return "ERROR: Se interrumpió la generación local.";
            }
        }
    }
    // Qwen3 puede insertar bloques internos de razonamiento entre <think>
    // y </think>. No mostrarlos ni pronunciarlos en la interfaz del alumno.
    while (true) {
        const auto start = answer.find("<think>");
        if (start == std::string::npos) break;
        const auto end = answer.find("</think>", start);
        if (end == std::string::npos) {
            answer.erase(start);
            break;
        }
        answer.erase(start, (end + std::strlen("</think>")) - start);
    }
    const auto first = answer.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) {
        return "ERROR: El modelo no devolvió contenido pedagógico visible.";
    }
    const auto last = answer.find_last_not_of(" \t\r\n");
    answer = answer.substr(first, last - first + 1);
    return answer;
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_pe_myteacheria_alumno_MotorLocalPlugin_generarNativo(
    JNIEnv * env, jclass, jstring path_value, jbyteArray question_value, jint max_tokens) {
    if (!path_value || !question_value) return to_java(env, "ERROR: Entrada incompleta.");
    const char * path_chars = env->GetStringUTFChars(path_value, nullptr);
    if (!path_chars) return to_java(env, "ERROR: Ruta inaccesible.");
    const std::string path(path_chars);
    env->ReleaseStringUTFChars(path_value, path_chars);
    const jsize n = env->GetArrayLength(question_value);
    if (n <= 0 || n > 10000) return to_java(env, "ERROR: Pregunta inválida.");
    std::string question(static_cast<size_t>(n), '\0');
    env->GetByteArrayRegion(question_value, 0, n, reinterpret_cast<jbyte *>(&question[0]));
    std::lock_guard<std::mutex> guard(g_inference_mutex);
    try {
        return to_java(env, infer(path, question, std::max(32, std::min(256, static_cast<int>(max_tokens)))));
    } catch (...) {
        return to_java(env, "ERROR: Se produjo un error interno en la IA local.");
    }
}

// Métodos instantáneos: el hilo UI puede cancelar sin bloquear en el mutex de inferencia.
extern "C" JNIEXPORT void JNICALL
Java_pe_myteacheria_alumno_MotorLocalPlugin_prepararNativo(JNIEnv *, jclass) {
    g_cancel_requested.store(false, std::memory_order_relaxed);
}

extern "C" JNIEXPORT void JNICALL
Java_pe_myteacheria_alumno_MotorLocalPlugin_cancelarNativo(JNIEnv *, jclass) {
    g_cancel_requested.store(true, std::memory_order_relaxed);
}
