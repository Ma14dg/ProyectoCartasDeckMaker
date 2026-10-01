import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  AlertTriangle,
  ArrowDownUp,
  Check,
  ChevronDown,
  CirclePlus,
  ClipboardList,
  Download,
  ExternalLink,
  Filter,
  Layers3,
  LoaderCircle,
  Minus,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import './App.css'

type Color = 'Blanco' | 'Azul' | 'Negro' | 'Rojo' | 'Verde'
type Format = 'standard' | 'commander'
type Zone = 'mainboard' | 'sideboard' | 'commander'

interface CardDefinition {
  oracleId?: string
  name: string
  manaCost?: string
  manaValue: number
  colors: Color[]
  colorIdentity: Color[]
  typeLine: string
  oracleText?: string
  legalities: Record<string, string>
  imageUris?: Record<string, string>
  faces?: Array<{ imageUris?: Record<string, string>; typeLine?: string; oracleText?: string }>
}

interface CardPrinting {
  id: string
  setCode: string
  setName: string
  collectorNumber: string
  language: string
  rarity: string
  artist?: string
  imageUris?: Record<string, string>
}

interface CardEntry {
  definition: CardDefinition
  printing: CardPrinting
}

interface DeckCard {
  printingId: string
  oracleId?: string
  quantity: number
  zone: Zone
  card: CardEntry
}

interface Deck {
  id: string
  name: string
  format: Format
  description?: string
  cards: DeckCard[]
  updatedAt: string
}

interface DeckExportFile {
  schemaVersion: 1
  exportedAt: string
  deck: Pick<Deck, 'name' | 'format' | 'description' | 'cards'>
}

interface SearchResponse {
  totalCards: number
  hasMore: boolean
  nextPage: string | null
  data: CardEntry[]
}

interface Validation {
  valid: boolean
  format: Format
  cardCount: number
  expectedCardCount: string
  commander?: DeckCard
  colorIdentity: Color[]
  issues: string[]
}

interface Statistics {
  totalCards: number
  mainboardCount: number
  sideboardCount: number
  commanderCount: number
  colors: Record<Color, number>
  cardTypes: Record<string, number>
  manaCurve: Record<string, number>
}

interface Filters {
  name: string
  color: string
  type: string
  manaValue: string
  set: string
}

const initialFilters: Filters = { name: '', color: '', type: '', manaValue: '', set: '' }
const colorOrder: Color[] = ['Blanco', 'Azul', 'Negro', 'Rojo', 'Verde']
const colorCode: Record<Color, string> = {
  Blanco: 'W',
  Azul: 'U',
  Negro: 'B',
  Rojo: 'R',
  Verde: 'G',
}
const emptyStatistics: Statistics = {
  totalCards: 0,
  mainboardCount: 0,
  sideboardCount: 0,
  commanderCount: 0,
  colors: { Blanco: 0, Azul: 0, Negro: 0, Rojo: 0, Verde: 0 },
  cardTypes: {},
  manaCurve: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7+': 0 },
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? ''}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string | string[] }
    const message = Array.isArray(payload?.message) ? payload.message.join(', ') : payload?.message
    throw new Error(message ?? `Error ${response.status}: no se pudo completar la solicitud`)
  }
  return response.json() as Promise<T>
}

function cardImage(card: CardEntry): string | undefined {
  return card.printing.imageUris?.normal
    ?? card.printing.imageUris?.small
    ?? card.definition.imageUris?.normal
    ?? card.definition.faces?.[0]?.imageUris?.normal
}

function manaSymbols(cost?: string): string[] {
  return cost?.match(/\{[^}]+\}/g) ?? []
}

function symbolLabel(symbol: string): string {
  return symbol.replace(/[{}]/g, '')
}

function App() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [zone, setZone] = useState<Zone>('mainboard')
  const [validation, setValidation] = useState<Validation | null>(null)
  const [statistics, setStatistics] = useState<Statistics>(emptyStatistics)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateDeck, setShowCreateDeck] = useState(false)
  const [deckName, setDeckName] = useState('')
  const [deckFormat, setDeckFormat] = useState<Format>('standard')
  const [deckEditMode, setDeckEditMode] = useState(false)
  const [editingName, setEditingName] = useState('')
  const [editingFormat, setEditingFormat] = useState<Format>('standard')
  const [searchPage, setSearchPage] = useState(1)
  const importInputRef = useRef<HTMLInputElement>(null)

  const selectedDeck = decks.find((deck) => deck.id === selectedDeckId) ?? decks[0]
  const activeDeckId = selectedDeck?.id

  async function loadDecks(preferredId?: string) {
    const items = await request<Deck[]>('/decks')
    setDecks(items)
    const nextSelected = preferredId ?? selectedDeckId
    if (nextSelected && items.some((deck) => deck.id === nextSelected)) {
      setSelectedDeckId(nextSelected)
    } else if (items[0]) {
      setSelectedDeckId(items[0].id)
    } else {
      setSelectedDeckId('')
    }
  }

  async function refreshDeckDetail(deckId: string) {
    const [deck, nextValidation, nextStatistics] = await Promise.all([
      request<Deck>(`/decks/${deckId}`),
      request<Validation>(`/decks/${deckId}/validation`),
      request<Statistics>(`/decks/${deckId}/statistics`),
    ])
    setDecks((current) => current.map((item) => item.id === deckId ? deck : item))
    setValidation(nextValidation)
    setStatistics(nextStatistics)
  }

  useEffect(() => {
    let active = true
    request<Deck[]>('/decks')
      .then(async (items) => {
        if (!active) return
        setDecks(items)
        if (items[0]) {
          setSelectedDeckId(items[0].id)
          try {
            const [nextValidation, nextStatistics] = await Promise.all([
              request<Validation>(`/decks/${items[0].id}/validation`),
              request<Statistics>(`/decks/${items[0].id}/statistics`),
            ])
            if (active) {
              setValidation(nextValidation)
              setStatistics(nextStatistics)
            }
          } catch (cause) {
            if (active) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el mazo')
          }
        } else {
          setSelectedDeckId('')
          setValidation(null)
          setStatistics(emptyStatistics)
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'No se pudo conectar con la API')
      })
    return () => { active = false }
  }, [])

  async function searchCards(event?: FormEvent, page = 1) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    setSearchPage(page)
    const params = new URLSearchParams({ page: String(page) })
    if (filters.name.trim()) params.set('name', filters.name.trim())
    if (filters.color) params.set('color', filters.color)
    if (filters.type.trim()) params.set('type', filters.type.trim())
    if (filters.manaValue.trim()) params.set('manaValue', filters.manaValue.trim())
    if (filters.set.trim()) params.set('set', filters.set.trim())
    try {
      setResults(await request<SearchResponse>(`/cards/search?${params.toString()}`))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La búsqueda no pudo completarse')
    } finally {
      setLoading(false)
    }
  }

  async function createDeck(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const deck = await request<Deck>('/decks', {
        method: 'POST',
        body: JSON.stringify({ name: deckName, format: deckFormat }),
      })
      setDeckName('')
      setShowCreateDeck(false)
      setNotice(`${deck.name} creado`)
      await loadDecks(deck.id)
      setSelectedDeckId(deck.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el mazo')
    } finally {
      setSaving(false)
    }
  }

  async function addCard(card: CardEntry, targetZone = zone) {
    if (!selectedDeck) {
      setError('Crea o selecciona un mazo antes de añadir cartas')
      return
    }
    setSaving(true)
    setError('')
    try {
      await request<Deck>(`/decks/${selectedDeck.id}/cards`, {
        method: 'POST',
        body: JSON.stringify({ card, quantity: 1, zone: targetZone }),
      })
      await refreshDeckDetail(selectedDeck.id)
      setNotice(`${card.definition.name} añadida a ${zoneLabels[targetZone]}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo añadir la carta')
    } finally {
      setSaving(false)
    }
  }

  async function changeQuantity(card: DeckCard, delta: number) {
    if (!selectedDeck) return
    const nextQuantity = card.quantity + delta
    if (nextQuantity < 1) {
      await removeDeckCard(card.printingId)
      return
    }
    setError('')
    try {
      await request<Deck>(`/decks/${selectedDeck.id}/cards/${card.printingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: nextQuantity }),
      })
      await refreshDeckDetail(selectedDeck.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cambiar la cantidad')
    }
  }

  async function removeDeckCard(printingId: string) {
    if (!selectedDeck) return
    try {
      await request<Deck>(`/decks/${selectedDeck.id}/cards/${printingId}`, { method: 'DELETE' })
      await refreshDeckDetail(selectedDeck.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo quitar la carta')
    }
  }

  async function moveCard(card: DeckCard, nextZone: Zone) {
    if (!selectedDeck) return
    try {
      await request<Deck>(`/decks/${selectedDeck.id}/cards/${card.printingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ zone: nextZone, quantity: nextZone === 'commander' ? 1 : card.quantity }),
      })
      await refreshDeckDetail(selectedDeck.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo mover la carta')
    }
  }

  async function saveDeckDetails(event: FormEvent) {
    event.preventDefault()
    if (!selectedDeck) return
    try {
      const deck = await request<Deck>(`/decks/${selectedDeck.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editingName, format: editingFormat }),
      })
      setDecks((current) => current.map((item) => item.id === deck.id ? deck : item))
      setDeckEditMode(false)
      await refreshDeckDetail(deck.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo editar el mazo')
    }
  }

  async function deleteDeck() {
    if (!selectedDeck || !window.confirm(`¿Eliminar el mazo “${selectedDeck.name}”?`)) return
    try {
      await request<Deck>(`/decks/${selectedDeck.id}`, { method: 'DELETE' })
      setNotice(`${selectedDeck.name} eliminado`)
      await loadDecks()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el mazo')
    }
  }

  async function exportDeck() {
    if (!selectedDeck) return
    setError('')
    try {
      const backup = await request<DeckExportFile>(`/decks/${selectedDeck.id}/export`)
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const downloadUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `${selectedDeck.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}.cardtable.json`
      anchor.click()
      URL.revokeObjectURL(downloadUrl)
      setNotice(`${selectedDeck.name} exportado`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo exportar el mazo')
    }
  }

  async function importDeckFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('El respaldo supera el límite de 2 MB')
      event.target.value = ''
      return
    }
    setSaving(true)
    setError('')
    try {
      const content: unknown = JSON.parse(await file.text())
      const importedDeck = await request<Deck>('/decks/import', {
        method: 'POST',
        body: JSON.stringify(content),
      })
      await loadDecks(importedDeck.id)
      await refreshDeckDetail(importedDeck.id)
      setNotice(`${importedDeck.name} importado`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'El archivo no es un respaldo válido de Cardtable')
    } finally {
      event.target.value = ''
      setSaving(false)
    }
  }

  function beginEditDeck() {
    if (!selectedDeck) return
    setEditingName(selectedDeck.name)
    setEditingFormat(selectedDeck.format)
    setDeckEditMode(true)
  }

  const groupedCards = (['commander', 'mainboard', 'sideboard'] as Zone[]).map((groupZone) => ({
    zone: groupZone,
    cards: selectedDeck?.cards.filter((card) => card.zone === groupZone) ?? [],
  }))
  const maxManaValue = Math.max(1, ...Object.values(statistics.manaCurve))

  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Cardtable inicio">
          <span className="brand-mark"><Layers3 size={18} /></span>
          <span>cardtable<span className="brand-period">.</span></span>
        </a>
        <div className="topbar-meta">
          <span className="api-status"><span className="status-dot" /> API local</span>
          <span className="volatile-note">Mazos temporales</span>
        </div>
      </header>

      <div className="page-heading">
        <div>
          <p className="eyebrow">TALLER DE MAZOS <span>01 / 03</span></p>
          <h1>Encuentra tu<br /><em>próxima jugada.</em></h1>
        </div>
        <p className="heading-note">Cartas de Scryfall. Tus ideas.<br />Sin prisa por afinarlo todo.</p>
      </div>

      <div className="status-messages" aria-live="polite">
        {error && <div className="message message-error"><AlertTriangle size={16} />{error}<button onClick={() => setError('')} aria-label="Cerrar error"><X size={14} /></button></div>}
        {notice && <div className="message message-success"><Check size={16} />{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={14} /></button></div>}
      </div>

      <div className="main-grid">
        <section className="search-panel" aria-labelledby="search-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CATÁLOGO</p>
              <h2 id="search-title">Busca una carta</h2>
            </div>
            <button className={`icon-button filter-toggle ${showFilters ? 'is-active' : ''}`} onClick={() => setShowFilters(!showFilters)} title="Mostrar filtros" aria-label="Mostrar filtros">
              <Filter size={17} />
            </button>
          </div>

          <form className="search-form" onSubmit={(event) => void searchCards(event)}>
            <label className="search-input-wrap">
              <Search size={18} />
              <input
                aria-label="Nombre de la carta"
                placeholder="Nombre de carta..."
                value={filters.name}
                onChange={(event) => setFilters({ ...filters, name: event.target.value })}
              />
              {filters.name && <button type="button" className="input-clear" onClick={() => setFilters({ ...filters, name: '' })} aria-label="Limpiar búsqueda"><X size={15} /></button>}
            </label>
            <button type="submit" className="search-submit" disabled={loading}>
              {loading ? <LoaderCircle className="spin" size={17} /> : 'Buscar'}
            </button>
          </form>

          {showFilters && <div className="filters-grid">
            <label>Color
              <select value={filters.color} onChange={(event) => setFilters({ ...filters, color: event.target.value })}>
                <option value="">Cualquiera</option>
                <option value="W">Blanco</option><option value="U">Azul</option><option value="B">Negro</option><option value="R">Rojo</option><option value="G">Verde</option><option value="C">Incoloro</option>
              </select>
            </label>
            <label>Tipo
              <input placeholder="Creature, Instant..." value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} />
            </label>
            <label>Valor de maná
              <input placeholder="p. ej. <=3" value={filters.manaValue} onChange={(event) => setFilters({ ...filters, manaValue: event.target.value })} />
            </label>
            <label>Expansión
              <input placeholder="p. ej. dsk" value={filters.set} onChange={(event) => setFilters({ ...filters, set: event.target.value })} />
            </label>
          </div>}

          {results && <div className="results-toolbar">
            <span>{results.totalCards.toLocaleString()} resultados</span>
            <div className="pagination-controls">
              <button className="text-button" disabled={searchPage <= 1 || loading} onClick={() => void searchCards(undefined, searchPage - 1)}>Anterior</button>
              <span>Página {searchPage}</span>
              <button className="text-button" disabled={!results.hasMore || loading} onClick={() => void searchCards(undefined, searchPage + 1)}>Siguiente</button>
            </div>
          </div>}

          {!results && <div className="empty-search">
            <span className="empty-glyph"><Search size={21} /></span>
            <p>¿Qué tienes en mente?</p>
            <span>Busca por nombre o abre los filtros para explorar.</span>
          </div>}
          {results?.data.length === 0 && <div className="empty-results">No encontramos cartas con esos filtros.</div>}

          <div className="results-list">
            {results?.data.map((entry) => {
              const image = cardImage(entry)
              const legal = selectedDeck ? entry.definition.legalities[selectedDeck.format] === 'legal' : false
              return <article className="result-row" key={entry.printing.id}>
                <div className="result-thumb">
                  {image ? <img src={image} alt="" loading="lazy" /> : <div className="thumb-placeholder"><Layers3 size={19} /></div>}
                </div>
                <div className="result-info">
                  <div className="result-name-line"><h3>{entry.definition.name}</h3><ManaCost cost={entry.definition.manaCost} /></div>
                  <p className="result-type">{entry.definition.typeLine}</p>
                  <div className="result-meta"><span>{entry.printing.setCode.toUpperCase()} · {entry.printing.collectorNumber}</span><span className={`rarity-dot rarity-${entry.printing.rarity.toLowerCase()}`} />{entry.printing.rarity}</div>
                  {selectedDeck && <span className={`legality-label ${legal ? 'is-legal' : 'is-unknown'}`}>{legal ? 'LEGAL' : 'NO LEGAL / SIN DATOS'}</span>}
                </div>
                <button className="add-card-button" title={`Añadir ${entry.definition.name} a ${zoneLabels[zone]}`} aria-label={`Añadir ${entry.definition.name}`} disabled={saving || !selectedDeck || (selectedDeck.format === 'commander' && zone === 'commander' && !isCommanderCandidate(entry))} onClick={() => void addCard(entry)}>
                  <Plus size={17} />
                </button>
              </article>
            })}
          </div>
          {results && results.data.length > 0 && <p className="attribution">Datos e imágenes de cartas: <a href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall <ExternalLink size={11} /></a></p>}
        </section>

        <section className="deck-panel" aria-labelledby="deck-title">
          <div className="section-heading deck-heading">
            <div>
              <p className="eyebrow">CONSTRUCTOR</p>
              <h2 id="deck-title">Tus mazos</h2>
            </div>
            <div className="deck-heading-actions">
              <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void importDeckFile(event)} aria-label="Importar respaldo de mazo" />
              <button className="icon-button" onClick={() => importInputRef.current?.click()} title="Importar respaldo JSON" aria-label="Importar respaldo JSON"><Upload size={17} /></button>
              <button className="icon-button create-deck-button" onClick={() => setShowCreateDeck(!showCreateDeck)} title="Crear mazo" aria-label="Crear mazo"><CirclePlus size={19} /></button>
            </div>
          </div>

          {showCreateDeck && <form className="create-deck-form" onSubmit={(event) => void createDeck(event)}>
            <label className="visually-hidden" htmlFor="new-deck-name">Nombre del mazo</label>
            <input id="new-deck-name" autoFocus placeholder="Nombre del mazo" value={deckName} onChange={(event) => setDeckName(event.target.value)} required />
            <select value={deckFormat} onChange={(event) => setDeckFormat(event.target.value as Format)} aria-label="Formato">
              <option value="standard">Standard</option><option value="commander">Commander</option>
            </select>
            <button type="submit" className="primary-small" disabled={saving}>Crear</button>
          </form>}

          {decks.length > 0 && <label className="deck-picker-label">MAZO ACTIVO
            <span className="select-wrap"><select value={activeDeckId ?? ''} onChange={(event) => {
              setSelectedDeckId(event.target.value)
              void refreshDeckDetail(event.target.value).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'No se pudo cargar el mazo'))
            }}>
              {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
            </select><ChevronDown size={14} /></span>
          </label>}

          {!selectedDeck && <div className="empty-deck">
            <ClipboardList size={22} />
            <p>Aún no hay un mazo en la mesa.</p>
            <span>Crea uno para empezar a guardar tus selecciones.</span>
            {!showCreateDeck && <button className="text-button" onClick={() => setShowCreateDeck(true)}>Crear primer mazo <ArrowDownUp size={13} /></button>}
          </div>}

          {selectedDeck && <>
            {deckEditMode ? <form className="deck-edit-form" onSubmit={(event) => void saveDeckDetails(event)}>
              <input value={editingName} onChange={(event) => setEditingName(event.target.value)} aria-label="Nombre del mazo" required />
              <select value={editingFormat} onChange={(event) => setEditingFormat(event.target.value as Format)} aria-label="Formato del mazo"><option value="standard">Standard</option><option value="commander">Commander</option></select>
              <button type="submit" className="primary-small">Guardar</button><button type="button" className="icon-button" onClick={() => setDeckEditMode(false)} aria-label="Cancelar"><X size={15} /></button>
            </form> : <div className="active-deck-title">
              <div><h3>{selectedDeck.name}</h3><span className={`format-tag format-${selectedDeck.format}`}>{selectedDeck.format}</span></div>
              <div className="deck-actions"><button className="icon-button" onClick={() => void exportDeck()} title="Exportar respaldo JSON" aria-label="Exportar respaldo JSON"><Download size={15} /></button><button className="text-button" onClick={beginEditDeck}>Editar</button><button className="icon-button danger-icon" onClick={() => void deleteDeck()} title="Eliminar mazo" aria-label="Eliminar mazo"><Trash2 size={15} /></button></div>
            </div>}

            <div className="deck-progress" aria-label={`${statistics.mainboardCount} cartas de ${selectedDeck.format === 'standard' ? '60 mínimo' : '99 más comandante'}`}>
              <div className="progress-track"><span style={{ width: `${Math.min(100, statistics.mainboardCount / (selectedDeck.format === 'standard' ? 60 : 99) * 100)}%` }} /></div>
              <span>{selectedDeck.format === 'standard' ? `${statistics.mainboardCount} / 60+` : `${statistics.mainboardCount} + ${statistics.commanderCount} / 100`}</span>
            </div>

            {selectedDeck.format === 'commander' && <div className={`commander-slot ${statistics.commanderCount ? 'has-commander' : ''}`}>
              <div className="commander-sigil">C</div>
              <div><span className="eyebrow">COMANDANTE</span><strong>{validation?.commander?.card.definition.name ?? 'Elige una criatura legendaria'}</strong></div>
              <span className="identity-dots">{validation?.commander?.card.definition.colorIdentity.map((color) => <i key={color} className={`color-dot color-${colorCode[color]}`} title={color} />)}</span>
            </div>}

            <div className="zone-selector" role="group" aria-label="Zona donde añadir cartas">
              {(['mainboard', 'sideboard', ...(selectedDeck.format === 'commander' ? ['commander'] : [])] as Zone[]).map((item) => <button key={item} className={zone === item ? 'selected' : ''} onClick={() => setZone(item)}>{zoneLabels[item]}</button>)}
            </div>

            <div className="deck-list">
              {groupedCards.filter((group) => group.zone !== 'commander' || selectedDeck.format === 'commander').map(({ zone: groupZone, cards }) => <div className="deck-zone" key={groupZone}>
                <div className="zone-heading"><span>{zoneLabels[groupZone]}</span><span>{cards.reduce((sum, card) => sum + card.quantity, 0)}</span></div>
                {cards.length === 0 ? <p className="zone-empty">Vacío</p> : cards.map((card) => <div className="deck-card-row" key={card.printingId}>
                  <span className="deck-card-quantity">{card.quantity}</span>
                  <span className="deck-card-name" title={card.card.definition.name}>{card.card.definition.name}</span>
                  <div className="deck-card-controls">
                    {groupZone !== 'commander' && <><button onClick={() => void changeQuantity(card, -1)} aria-label={`Quitar una copia de ${card.card.definition.name}`}><Minus size={12} /></button><button onClick={() => void changeQuantity(card, 1)} aria-label={`Añadir una copia de ${card.card.definition.name}`}><Plus size={12} /></button></>}
                    {groupZone === 'mainboard' && <button onClick={() => void moveCard(card, 'sideboard')} title="Mover al sideboard" aria-label={`Mover ${card.card.definition.name} al sideboard`}><ArrowDownUp size={12} /></button>}
                    {groupZone === 'sideboard' && <button onClick={() => void moveCard(card, 'mainboard')} title="Mover al mainboard" aria-label={`Mover ${card.card.definition.name} al mainboard`}><ArrowDownUp size={12} /></button>}
                    <button onClick={() => void removeDeckCard(card.printingId)} aria-label={`Quitar ${card.card.definition.name}`}><X size={12} /></button>
                  </div>
                </div>)}
              </div>)}
            </div>

            <div className="analysis-section">
              <div className="analysis-heading"><h3>Lectura del mazo</h3><span>{statistics.totalCards} total</span></div>
              <div className="color-distribution" aria-label="Distribución de colores">{colorOrder.map((color) => <div key={color} className="color-stat" title={`${color}: ${statistics.colors[color]} cartas`}><i className={`color-dot color-${colorCode[color]}`} /><span>{statistics.colors[color]}</span></div>)}</div>
              <div className="mana-curve" aria-label="Curva de maná">{Object.entries(statistics.manaCurve).map(([cost, count]) => <div className="curve-column" key={cost}><span className="curve-count">{count || ''}</span><div className="curve-bar-track"><span style={{ height: `${count ? Math.max(5, count / maxManaValue * 100) : 0}%` }} /></div><span className="curve-label">{cost}</span></div>)}</div>
              <div className={`validation-result ${validation?.valid ? 'is-valid' : 'is-invalid'}`}>
                {validation?.valid ? <Check size={15} /> : <ShieldAlert size={15} />}
                <div><strong>{validation?.valid ? 'Reglas básicas: correcto' : 'Mazo en construcción'}</strong>
                  {validation?.issues.slice(0, 2).map((issue) => <span key={issue}>{issue}</span>)}
                  {validation && validation.issues.length > 2 && <span>+{validation.issues.length - 2} incidencias más</span>}
                </div>
              </div>
            </div>
          </>}
        </section>
      </div>

      <footer className="app-footer"><span>Una mesa tranquila para tus ideas.</span><span><span className="status-dot" /> Sin sincronización permanente</span></footer>
    </main>
  )
}

const zoneLabels: Record<Zone, string> = {
  mainboard: 'Mainboard',
  sideboard: 'Sideboard',
  commander: 'Commander',
}

function isCommanderCandidate(entry: CardEntry): boolean {
  const typeLines = [entry.definition.typeLine, ...(entry.definition.faces?.map((face) => face.typeLine).filter((value): value is string => Boolean(value)) ?? [])]
  return typeLines.some((typeLine) => /\bLegendary\b.*\bCreature\b/i.test(typeLine))
    || /can be your commander/i.test([entry.definition.oracleText, ...(entry.definition.faces?.map((face) => face.oracleText) ?? [])].filter(Boolean).join(' '))
}

function ManaCost({ cost }: { cost?: string }) {
  const symbols = manaSymbols(cost)
  if (!symbols.length) return null
  return <span className="mana-cost">{symbols.map((symbol, index) => <span key={`${symbol}-${index}`} className={`mana-symbol mana-${symbolLabel(symbol).toLowerCase()}`}>{symbolLabel(symbol)}</span>)}</span>
}

export default App