from pathlib import Path

root = Path(__file__).resolve().parents[2]

backend_path = root / "backend/app/main.py"
frontend_path = root / "frontend/conauti-ui/main.tsx"

back = backend_path.read_text(encoding="utf-8")
front = frontend_path.read_text(encoding="utf-8")

if "app.include_router(conauti_ai_router)" not in back:
    back += (
        "\n\nfrom app.conauti_ai import "
        "router as conauti_ai_router\n"
        "app.include_router(conauti_ai_router)\n"
    )

if "retryId" not in front:

    anchor = "  const editor = useRef<HTMLTextAreaElement>(null)"

    if anchor not in front:
        raise RuntimeError(
            "No se encontro la referencia del editor."
        )

    front = front.replace(
        anchor,
        anchor + "\n"
        "  const retryId = useRef<string | null>(null)",
        1,
    )

    start = front.find(
        "      const result = await api<Message>(\n"
        "        `/conversations/${id}/messages`,"
    )

    end = front.find(
        "    } catch (error) {",
        start,
    )

    if start < 0 or end < 0:
        raise RuntimeError(
            "No se reconoce la funcion de envio actual."
        )

    replacement = """      if (!retryId.current) {
        retryId.current = crypto.randomUUID()
      }

      const response = await api<{
        user_message: Message
        assistant_message: Message
        reused: boolean
      }>(
        `/ai/conversations/${id}/respond`,
        token,
        'POST',
        {
          text: draft.trim(),
          request_id: retryId.current,
        }
      )

      setMessages(previous => {
        const existing = new Set(previous.map(m => m.id))

        return [
          ...previous,
          response.user_message,
          response.assistant_message,
        ].filter(message => {
          if (existing.has(message.id)) return false
          existing.add(message.id)
          return true
        })
      })

      retryId.current = null
      setDraft('')
      await refresh(token)
      setNotice('Respuesta educativa generada correctamente.')
"""

    front = front[:start] + replacement + front[end:]

    old = "    setDraft('')\n    setNotice('')"

    if old in front:
        front = front.replace(
            old,
            "    setDraft('')\n"
            "    retryId.current = null\n"
            "    setNotice('')",
            1,
        )

    old_change = "onChange={e => setDraft(e.target.value)}"

    new_change = """onChange={e => {
                    retryId.current = null
                    setDraft(e.target.value)
                  }}"""

    if old_change not in front:
        raise RuntimeError(
            "No se encontro el editor del mensaje."
        )

    front = front.replace(
        old_change,
        new_change,
        1,
    )

    old_notice = (
        "Los mensajes se guardan en PostgreSQL.\n"
        "                La IA se integrará en la fase 06."
    )

    front = front.replace(
        old_notice,
        "Las respuestas se generan mediante IA real "
        "cuando el proveedor está configurado.",
        1,
    )

if "/ai/conversations/${id}/respond" not in front:
    raise RuntimeError(
        "No se pudo verificar la integración del chat."
    )

backend_path.write_text(back, encoding="utf-8")
frontend_path.write_text(front, encoding="utf-8")

print("RUTAS_FASTAPI=INTEGRADAS")
print("CHAT_REACT=IA_CONECTADA")
print("SOLICITUDES_REPETIDAS=CONTROLADAS")
