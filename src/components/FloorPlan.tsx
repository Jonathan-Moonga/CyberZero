export type IncidentStatus = 'idle' | 'active' | 'isolated'

type Row = 'top' | 'bottom'

interface Room {
  id: string
  x: number
  w: number
  name: string
  label?: string
  core?: boolean
  affected?: boolean
  workstation?: string
}

const ROW_Y: Record<Row, number> = { top: 80, bottom: 320 }
const ROW_HEIGHT = 185
const DOOR_SIZE = 26

const SOURCE_IP = '203.0.113.42'

const TOP_ROOMS: Room[] = [
  { id: '2A', label: '2A', name: 'Operations', x: 30, w: 132 },
  { id: '2B', label: '2B', name: 'Operations', x: 162, w: 132, affected: true, workstation: 'CZ-OPS-204' },
  { id: '2C', label: '2C', name: 'Finance', x: 294, w: 132 },
  { id: '2D', label: '2D', name: 'Finance', x: 426, w: 132 },
  { id: 'server', name: 'Server room', x: 558, w: 132 },
]

const BOTTOM_ROOMS: Room[] = [
  { id: '2E', label: '2E', name: 'Human Resources', x: 30, w: 120 },
  { id: '2F', label: '2F', name: 'Human Resources', x: 150, w: 120 },
  { id: 'core', name: 'Core', x: 270, w: 60, core: true },
  { id: '2G', label: '2G', name: 'Executive', x: 330, w: 120 },
  { id: '2H', label: '2H', name: 'Executive', x: 450, w: 120 },
  { id: 'conference', name: 'Conference', x: 570, w: 120 },
]

// Affected rooms draw last so their walls sit on top of the neighbouring rooms' walls.
const PLACED_ROOMS = [
  ...TOP_ROOMS.map(room => ({ room, row: 'top' as Row })),
  ...BOTTOM_ROOMS.map(room => ({ room, row: 'bottom' as Row })),
].sort((a, b) => Number(a.room.affected ?? false) - Number(b.room.affected ?? false))

const AFFECTED = PLACED_ROOMS.find(({ room }) => room.affected)!
const deskX = (room: Room) => room.x + room.w - 54
const deskY = (row: Row) => ROW_Y[row] + (row === 'top' ? 96 : 118)
const ROUTE_X = deskX(AFFECTED.room) + 21
const ROUTE_END_Y = deskY(AFFECTED.row) + 10
const WALL_Y = ROW_Y.top

function describe(status: IncidentStatus) {
  const rooms = PLACED_ROOMS.filter(({ room }) => room.affected).map(({ room }) => `${room.name} ${room.label}, workstation ${room.workstation}`).join('; ')
  if (status === 'active') return `Floor 2 plan. Affected: ${rooms}, under simulated attack from ${SOURCE_IP}.`
  if (status === 'isolated') return `Floor 2 plan. Contained: ${rooms}. Link from ${SOURCE_IP} is cut.`
  return 'Floor 2 plan. No offices are affected.'
}

function Door({ room, row }: { room: Room; row: Row }) {
  const x = room.x + room.w / 2 - DOOR_SIZE / 2
  const y = row === 'top' ? ROW_Y.top + ROW_HEIGHT : ROW_Y.bottom
  const leafY = row === 'top' ? y - DOOR_SIZE : y + DOOR_SIZE
  return <>
    <line className="fp-door-gap" x1={x} y1={y} x2={x + DOOR_SIZE} y2={y}/>
    <path className="fp-door" d={`M${x} ${y} L${x} ${leafY} A${DOOR_SIZE} ${DOOR_SIZE} 0 0 ${row === 'top' ? 1 : 0} ${x + DOOR_SIZE} ${y}`}/>
  </>
}

function Office({ room, row, status }: { room: Room; row: Row; status: IncidentStatus }) {
  const y = ROW_Y[row]
  const hot = room.affected && status !== 'idle'
  const textX = room.x + 12
  const textY = y + (row === 'top' ? 30 : 56)

  if (room.core) {
    const centre = room.x + room.w / 2
    return <g className="fp-room fp-core">
      <rect className="fp-floor" x={room.x} y={y} width={room.w} height={ROW_HEIGHT}/>
      <line className="fp-door" x1={room.x} y1={y + ROW_HEIGHT / 2} x2={room.x + room.w} y2={y + ROW_HEIGHT / 2}/>
      <text className="fp-core-text" x={centre} y={y + 50} textAnchor="middle">LIFTS</text>
      <text className="fp-core-text" x={centre} y={y + 140} textAnchor="middle">STAIRS</text>
    </g>
  }

  return <g className={`fp-room${hot ? ` fp-${status}` : ''}`} data-room={room.id} data-state={hot ? status : 'normal'}>
    <rect className="fp-floor" x={room.x} y={y} width={room.w} height={ROW_HEIGHT}/>
    <Door room={room} row={row}/>
    {room.label && <rect className="fp-desk" x={deskX(room)} y={deskY(row)} width={42} height={20} rx={2}/>}
    <text className={room.label ? 'fp-label' : 'fp-label fp-label-shared'} x={textX} y={textY}>{room.label ?? room.name}</text>
    {room.label && <text className="fp-name" x={textX} y={textY + 17}>{room.name}</text>}
    {hot && <>
      <text className="fp-tag" x={textX} y={textY + 44}>{room.workstation}</text>
      <text className="fp-tag fp-tag-state" x={textX} y={textY + 60}>{status === 'active' ? 'BREACHED' : 'CONTAINED'}</text>
    </>}
  </g>
}

export function FloorPlan({ status }: { status: IncidentStatus }) {
  return <div className="floor-plan">
    <svg viewBox="0 0 720 525" role="img" aria-label={describe(status)} preserveAspectRatio="xMidYMid meet">
      <text className="fp-floor-title" x={690} y={42} textAnchor="end">FLOOR 2</text>

      <rect className="fp-building" x={30} y={WALL_Y} width={660} height={425}/>
      <text className="fp-corridor" x={360} y={297} textAnchor="middle">MAIN CORRIDOR</text>

      {PLACED_ROOMS.map(({ room, row }) => <Office key={room.id} room={room} row={row} status={status}/>)}

      {status !== 'idle' && <g className={`fp-trace fp-trace-${status}`}>
        <path className="fp-route" d={status === 'active' ? `M152 37 H${ROUTE_X} V${ROUTE_END_Y}` : `M152 37 H${ROUTE_X} V${WALL_Y}`}/>
        <rect className="fp-source" x={30} y={16} width={122} height={42} rx={6}/>
        <text className="fp-source-ip" x={91} y={34} textAnchor="middle">{SOURCE_IP}</text>
        <text className="fp-source-tag" x={91} y={49} textAnchor="middle">EXTERNAL</text>
        {status === 'active'
          ? <circle className="fp-node" cx={ROUTE_X} cy={ROUTE_END_Y} r={6}/>
          : <path className="fp-cut" d={`M${ROUTE_X - 8} ${WALL_Y - 8} l16 16 m0 -16 l-16 16`}/>}
      </g>}
    </svg>
  </div>
}
