from pathlib import Path

root = Path(__file__).resolve().parents[2]
backend_main = root / "backend/app/main.py"
frontend_main = root / "frontend/conauti-ui/main.tsx"

back = backend_main.read_text(encoding="utf-8")
front = frontend_main.read_text(encoding="utf-8")

# Preparar todas las modificaciones antes de escribir.
# Si una estructura no coincide, no se sobrescribe el archivo.

if "app.include_router(conauti_history_router)" not in back:
    back += (
        "\n\n"
        "from app.conauti_history import "
        "router as conauti_history_router\n"
        "app.include_router(conauti_history_router)\n"
    )

if "HistorialAvanzado" not in front:

    anchor = "import './style.css'"

    if anchor not in front:
        raise RuntimeError(
            "No se encontro la entrada de estilos React."
        )

    front = front.replace(
        anchor,
        "import HistorialAvanzado "
        "from './HistorialAvanzado'\n"
        + anchor,
        1,
    )

    anchor = (
        "  const [history, setHistory] = "
        "useState<Conversation[]>([])\n"
    )

    if anchor not in front:
        raise RuntimeError(
            "No se encontro el estado del historial."
        )

    front = front.replace(
        anchor,
        anchor
        + "  const [historyVersion, setHistoryVersion] = "
          "useState(0)\n"
        + "  const [hasOlder, setHasOlder] = "
          "useState(false)\n"
        + "  const [beforeId, setBeforeId] = "
          "useState<number | null>(null)\n"
        + "  const [loadingOlder, setLoadingOlder] = "
          "useState(false)\n",
        1,
    )

    if "  const [search, setSearch] = useState('')\n" in front:
        front = front.replace(
            "  const [search, setSearch] = useState('')\n",
            "",
            1,
        )

    front = front.replace(
        "    setHistory(data)\n",
        "    setHistory(data)\n"
        "    setHistoryVersion(value => value + 1)\n",
        1,
    )

    old = """      const data = await api<Message[]>(
        `/conversations/${id}/messages`, token
      )
      if (number === requestNumber.current) {
        setMessages(data)
      }"""

    new = """      const data = await api<{
        items: Message[]
        has_more: boolean
        next_before: number | null
      }>(
        `/history/conversations/${id}/messages?limit=30`,
        token
      )
      if (number === requestNumber.current) {
        setMessages(data.items)
        setHasOlder(data.has_more)
        setBeforeId(data.next_before)
      }"""

    if old not in front:
        raise RuntimeError(
            "No se reconoce la carga original de mensajes."
        )

    front = front.replace(old, new, 1)

    anchor = """  function newChat() {
    requestNumber.current++
    setActive(null)
    setMessages([])
"""

    replacement = """  function newChat() {
    requestNumber.current++
    setActive(null)
    setMessages([])
    setHasOlder(false)
    setBeforeId(null)
"""

    if anchor not in front:
        raise RuntimeError(
            "No se reconoce la funcion de nueva conversacion."
        )

    front = front.replace(anchor, replacement, 1)

    anchor = "  async function send(e?: FormEvent) {"

    if anchor not in front:
        raise RuntimeError(
            "No se reconoce el formulario del chat."
        )

    loader = """  async function loadOlder() {
    if (!token || !active || !beforeId || loadingOlder) return

    const number = requestNumber.current
    const conversation = active

    setLoadingOlder(true)

    try {
      const result = await api<{
        items: Message[]
        has_more: boolean
        next_before: number | null
      }>(
        `/history/conversations/${conversation}/messages`
        + `?limit=30&before_id=${beforeId}`,
        token
      )

      if (number === requestNumber.current) {
        setMessages(previous => {
          const existing = new Set(previous.map(m => m.id))
          return [
            ...result.items.filter(m => !existing.has(m.id)),
            ...previous,
          ]
        })
        setHasOlder(result.has_more)
        setBeforeId(result.next_before)
      }
    } catch (error) {
      setNotice(errorText(error))
    } finally {
      setLoadingOlder(false)
    }
  }

"""

    front = front.replace(anchor, loader + anchor, 1)

    start = front.find('        <div className="history">')
    end = front.find('        <div className="account">', start)

    if start < 0 or end < 0:
        raise RuntimeError(
            "No se reconoce el panel lateral del historial."
        )

    new_panel = """        <HistorialAvanzado
          token={token}
          selected={active}
          revision={historyVersion}
          onOpen={id => void openChat(id)}
          onRename={item => void rename(item)}
          onDelete={item => void remove(item)}
        />

"""

    front = front[:start] + new_panel + front[end:]

    start = front.find("  const filtered = history.filter(")
    end = front.find("\n\n  if (checking)", start)

    if start < 0 or end < 0:
        raise RuntimeError(
            "No se reconoce la busqueda local anterior."
        )

    front = front[:start] + front[end + 2:]

    anchor = """                <div className="message-list">
                  {messages.map(m => ("""

    replacement = """                <div className="message-list">
                  {hasOlder && (
                    <button
                      type="button"
                      className="mensajes-anteriores"
                      disabled={loadingOlder}
                      onClick={() => void loadOlder()}
                    >
                      {loadingOlder
                        ? 'Cargando mensajes anteriores...'
                        : 'Cargar mensajes anteriores'}
                    </button>
                  )}
                  {messages.map(m => ("""

    if anchor not in front:
        raise RuntimeError(
            "No se encontro la lista de mensajes."
        )

    front = front.replace(anchor, replacement, 1)

    if (
        "HistorialAvanzado" not in front
        or "loadOlder()" not in front
        or "/history/conversations/" not in front
    ):
        raise RuntimeError(
            "La integracion del historial esta incompleta."
        )

backend_main.write_text(back, encoding="utf-8")
frontend_main.write_text(front, encoding="utf-8")

print("FASTAPI_HISTORIAL=INTEGRADO")
print("REACT_HISTORIAL=INTEGRADO")
print("PAGINACION_MENSAJES=INTEGRADA")
print("BUSQUEDA_SERVIDOR=INTEGRADA")
