import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'

function CameraRig({ focus }: { focus: boolean }) {
  const { camera } = useThree()
  useFrame(() => { const target = focus ? new THREE.Vector3(6.2, 5.2, 9.5) : new THREE.Vector3(10, 10, 14); camera.position.lerp(target, .025); camera.lookAt(0, 2.5, 0) })
  return null
}

function Building({ isolated }: { isolated: boolean }) {
  const group = useRef<THREE.Group>(null)
  const affected = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => { if (group.current) group.current.rotation.y = Math.sin(clock.elapsedTime * .13) * .16; if (affected.current) { const s = 1 + Math.sin(clock.elapsedTime * 4) * .06; affected.current.scale.set(s, s, s) } })
  const rooms = []
  for (let floor = 0; floor < 3; floor++) for (let room = 0; room < 4; room++) {
    const x = (room % 2) * 4 - 2; const z = Math.floor(room / 2) * 4 - 2; const y = floor * 3
    const isAffected = floor === 1 && room === 3
    rooms.push(<mesh key={`${floor}-${room}`} ref={isAffected ? affected : undefined} position={[x, y, z]}><boxGeometry args={[3.6, 2.5, 3.6]}/><meshStandardMaterial color={isAffected ? (isolated ? '#a8bc6a' : '#ef4444') : floor === 2 ? '#25314a' : '#162238'} transparent opacity={isAffected ? .82 : .52} emissive={isAffected ? (isolated ? '#22c55e' : '#ef4444') : '#08101f'} emissiveIntensity={isAffected ? 1.1 : .15} wireframe={!isAffected}/>{isAffected && <Html position={[0, 1.8, 0]} center><div className={`room-label ${isolated ? 'safe' : ''}`}>F2 · ROOM 2B<br/><strong>CZ-OPS-204</strong></div></Html>}</mesh>)
  }
  return <group ref={group}>{rooms}<mesh position={[2, 3.2, 2]}><sphereGeometry args={[.18, 16, 16]}/><meshStandardMaterial color={isolated ? '#22c55e' : '#ff2f6d'} emissive={isolated ? '#22c55e' : '#ff2f6d'} emissiveIntensity={2}/></mesh><Line points={[[-9, 7, 6], [-5, 5, 3], [2, 3.2, 2]]} color={isolated ? '#a8bc6a' : '#ff2f6d'} lineWidth={2}/><mesh position={[-9, 7, 6]}><icosahedronGeometry args={[.45, 1]}/><meshStandardMaterial color={isolated ? '#f59e0b' : '#ff2f6d'} emissive={isolated ? '#f59e0b' : '#ff2f6d'} emissiveIntensity={1.5}/><Html center position={[0, 1, 0]}><div className="source-label">203.0.113.42<br/>EXTERNAL</div></Html></mesh></group>
}

export function Building3D({ isolated = false, focus = true }: { isolated?: boolean; focus?: boolean }) {
  useEffect(() => { /* Canvas boundary intentionally owns the scene lifecycle. */ }, [])
  return <div className="building-canvas"><Suspense fallback={<div className="canvas-loading">Initializing secure 3D view…</div>}><Canvas camera={{ position: [10, 10, 14], fov: 42 }} dpr={[1, 1.5]}><color attach="background" args={['#090d17']}/><fog attach="fog" args={['#090d17', 16, 32]}/><ambientLight intensity={.8}/><directionalLight position={[8, 12, 6]} intensity={1.5} color="#9edfff"/><pointLight position={[-8, 8, 6]} intensity={20} color="#ff2f6d"/><gridHelper args={[30, 30, '#22314d', '#121a29']} position={[0, -1.4, 0]}/><Building isolated={isolated}/><CameraRig focus={focus}/><OrbitControls enablePan={false} minDistance={8} maxDistance={22} minPolarAngle={.45} maxPolarAngle={1.35}/></Canvas></Suspense></div>
}
