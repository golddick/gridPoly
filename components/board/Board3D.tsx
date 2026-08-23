




// "use client";

// import { useEffect, useMemo, useRef } from "react";
// import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
// import { OrbitControls } from "@react-three/drei";
// import * as THREE from "three";
// import { boardIndex, hopPath, isWalkableHop, jailPosition, tileLayoutPosition } from "@/lib/game/board";
// import { createInitialGameState, tileCurrentValue } from "@/lib/game/engine";
// import type { GameState, TileType } from "@/lib/game/types";
// import { pieceColor } from "@/components/PieceSelector";
// import { tileLabelTexture, cornerLabelTexture, parchmentTexture, tickerTexture } from "./tileTextures";
// import Dice3D from "./Dice3D";

// // Bright, saturated "printed board game" accent colors — these sit on a
// // cream card body (see tileTextures.ts), not glowing on a dark panel.
// const TILE_COLOR: Record<TileType, string> = {
//   go: "#C0392B",
//   jail: "#8A7A5E",
//   go_to_jail: "#A83232",
//   exchange_floor: "#9C9078",
//   chance: "#E0A72E",
//   community: "#2E8B57",
//   property: "#3C8F6D",
//   estate: "#D4AF37",
//   bond: "#4A9B7F",
//   contract: "#D4AF37",
//   betting: "#B23A2E",
//   tech_company: "#7A4FB5",
//   crypto: "#8A5FC7",
//   startup: "#7A4FB5",
// };

// const CORNER_NAMES: Record<string, string> = {
//   go: "START",
//   jail: "JAIL",
//   exchange_floor: "THE EXCHANGE",
//   go_to_jail: "GO TO JAIL",
// };

// export interface BoardPlayer {
//   id: string;
//   position: number;
//   pieceId: string;
//   inJail: boolean;
// }

// export interface TileVisualState {
//   ownerPlayerId: string | null;
//   buildLevel?: number;
//   mortgaged?: boolean;
//   forSalePrice?: number | null;
// }

// // ---------- shared geometries (created once, reused across every tile) ----------
// const HOUSE_BODY = new THREE.BoxGeometry(0.1, 0.09, 0.1);
// const HOUSE_ROOF = new THREE.ConeGeometry(0.08, 0.07, 4);
// const HOTEL_BODY = new THREE.BoxGeometry(0.22, 0.32, 0.22);
// const HOTEL_CAP = new THREE.ConeGeometry(0.17, 0.14, 4);
// const FLAG_POLE = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6);
// const FLAG = new THREE.PlaneGeometry(0.08, 0.05);

// function labelForTile(tile: { type: TileType; name: string; basePrice: number }, value: number) {
//   const isCorner = tile.type === "go" || tile.type === "jail" || tile.type === "exchange_floor" || tile.type === "go_to_jail";
//   if (isCorner) return cornerLabelTexture(CORNER_NAMES[tile.type] ?? tile.name, TILE_COLOR[tile.type]);
//   const subtitle = value > 0 ? `$${value.toLocaleString()}` : "";
//   return tileLabelTexture(tile.name, subtitle, TILE_COLOR[tile.type]);
// }

// function PropertyStructure({ buildLevel = 0, gold = false }: { buildLevel?: number; gold?: boolean }) {
//   if (buildLevel === 0) {
//     return (
//       <group position={[0, 0.09, 0]}>
//         <mesh geometry={FLAG_POLE} position={[0, 0, 0]}>
//           <meshStandardMaterial color="#B0A78C" roughness={0.5} metalness={0.2} />
//         </mesh>
//         <mesh geometry={FLAG} position={[0.04, 0.06, 0]}>
//           <meshStandardMaterial color={gold ? "#D4AF37" : "#3C8F6D"} side={THREE.DoubleSide} roughness={0.6} />
//         </mesh>
//       </group>
//     );
//   }
//   if (buildLevel >= 5) {
//     return (
//       <group position={[0, 0.16, 0]}>
//         <mesh geometry={HOTEL_BODY} position={[0, 0.16, 0]} castShadow receiveShadow>
//           <meshStandardMaterial color={gold ? "#F0D68A" : "#FBF6E9"} roughness={0.55} />
//         </mesh>
//         <mesh geometry={HOTEL_CAP} position={[0, 0.39, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
//           <meshStandardMaterial color="#D4AF37" roughness={0.3} metalness={0.4} />
//         </mesh>
//       </group>
//     );
//   }
//   const positions: [number, number][] = [
//     [-0.06, -0.06],
//     [0.06, -0.06],
//     [-0.06, 0.06],
//     [0.06, 0.06],
//   ];
//   return (
//     <group position={[0, 0.08, 0]}>
//       {positions.slice(0, buildLevel).map(([x, z], i) => (
//         <group key={i} position={[x, 0, z]}>
//           <mesh geometry={HOUSE_BODY} position={[0, 0.045, 0]} castShadow receiveShadow>
//             <meshStandardMaterial color="#FBF6E9" roughness={0.6} />
//           </mesh>
//           <mesh geometry={HOUSE_ROOF} position={[0, 0.125, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
//             <meshStandardMaterial color={gold ? "#D4AF37" : "#3C8F6D"} roughness={0.5} />
//           </mesh>
//         </group>
//       ))}
//     </group>
//   );
// }

// function BettingWheel() {
//   const ref = useRef<THREE.Group>(null);
//   useFrame((_, delta) => {
//     if (ref.current) ref.current.rotation.y += delta * 1.2;
//   });
//   return (
//     <group position={[0, 0.1, 0]}>
//       <mesh position={[0, 0, 0]} castShadow receiveShadow>
//         <cylinderGeometry args={[0.15, 0.17, 0.1, 16]} />
//         <meshStandardMaterial color="#8A7355" roughness={0.55} metalness={0.1} />
//       </mesh>
//       <group ref={ref} position={[0, 0.08, 0]}>
//         <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
//           <cylinderGeometry args={[0.16, 0.16, 0.02, 16, 1, false]} />
//           <meshStandardMaterial color="#B23A2E" roughness={0.4} />
//         </mesh>
//         <mesh position={[0, 0.015, 0]}>
//           <sphereGeometry args={[0.03, 8, 8]} />
//           <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.6} />
//         </mesh>
//       </group>
//     </group>
//   );
// }

// function TechTower() {
//   return (
//     <group position={[0, 0.22, 0]}>
//       <mesh castShadow>
//         <boxGeometry args={[0.16, 0.44, 0.16]} />
//         <meshPhysicalMaterial color="#A57FE0" transparent opacity={0.8} roughness={0.1} clearcoat={0.8} />
//       </mesh>
//       <mesh position={[0, 0.28, 0]}>
//         <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
//         <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.6} />
//       </mesh>
//     </group>
//   );
// }

// function CryptoCrystal() {
//   const ref = useRef<THREE.Mesh>(null);
//   useFrame(({ clock }) => {
//     if (!ref.current) return;
//     ref.current.rotation.y = clock.elapsedTime * 0.6;
//     ref.current.position.y = 0.24 + Math.sin(clock.elapsedTime * 1.4) * 0.03;
//   });
//   return (
//     <mesh ref={ref} position={[0, 0.24, 0]} castShadow>
//       <octahedronGeometry args={[0.13]} />
//       <meshPhysicalMaterial color="#8A5FC7" roughness={0.15} clearcoat={0.6} transmission={0.15} />
//     </mesh>
//   );
// }

// function StartupRocket() {
//   return (
//     <group position={[0, 0.24, 0]}>
//       <mesh position={[0, -0.06, 0]} castShadow>
//         <cylinderGeometry args={[0.06, 0.07, 0.18, 10]} />
//         <meshStandardMaterial color="#FBF6E9" roughness={0.5} />
//       </mesh>
//       <mesh position={[0, 0.06, 0]} castShadow>
//         <coneGeometry args={[0.06, 0.14, 10]} />
//         <meshStandardMaterial color="#7A4FB5" roughness={0.4} />
//       </mesh>
//     </group>
//   );
// }

// function BondVault() {
//   return (
//     <group position={[0, 0.1, 0]}>
//       <mesh castShadow receiveShadow>
//         <boxGeometry args={[0.24, 0.2, 0.2]} />
//         <meshStandardMaterial color="#4A9B7F" metalness={0.35} roughness={0.35} />
//       </mesh>
//       <mesh position={[0, 0, 0.101]} rotation={[Math.PI / 2, 0, 0]}>
//         <cylinderGeometry args={[0.045, 0.045, 0.01, 16]} />
//         <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.6} />
//       </mesh>
//     </group>
//   );
// }

// function CardStanding({ deck }: { deck: "chance" | "community" }) {
//   const texture = useMemo(() => tileLabelTexture(deck === "chance" ? "?" : "COMMUNITY", "", TILE_COLOR[deck]), [deck]);
//   return (
//     <group position={[0, 0.15, 0]}>
//       <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
//         <cylinderGeometry args={[0.09, 0.1, 0.02, 12]} />
//         <meshStandardMaterial color="#8A7355" roughness={0.5} />
//       </mesh>
//       <mesh castShadow>
//         <planeGeometry args={[0.16, 0.2]} />
//         <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.6} />
//       </mesh>
//     </group>
//   );
// }

// function JailCage() {
//   const bars = Array.from({ length: 7 }, (_, i) => -0.28 + (i * 0.56) / 6);
//   return (
//     <group position={[0, 0.16, -0.08]}>
//       <mesh position={[0, 0, -0.14]} castShadow receiveShadow>
//         <boxGeometry args={[0.6, 0.32, 0.02]} />
//         <meshStandardMaterial color="#B0A78C" roughness={0.6} />
//       </mesh>
//       <mesh position={[-0.3, 0, 0]} castShadow receiveShadow>
//         <boxGeometry args={[0.02, 0.32, 0.28]} />
//         <meshStandardMaterial color="#B0A78C" roughness={0.6} />
//       </mesh>
//       <mesh position={[0.3, 0, 0]} castShadow receiveShadow>
//         <boxGeometry args={[0.02, 0.32, 0.28]} />
//         <meshStandardMaterial color="#B0A78C" roughness={0.6} />
//       </mesh>
//       {bars.map((x, i) => (
//         <mesh key={i} position={[x, 0, 0.13]} castShadow>
//           <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
//           <meshStandardMaterial color="#C9C2AC" metalness={0.7} roughness={0.25} />
//         </mesh>
//       ))}
//       <mesh position={[0, 0.15, 0.13]}>
//         <boxGeometry args={[0.6, 0.02, 0.02]} />
//         <meshStandardMaterial color="#C9C2AC" metalness={0.7} roughness={0.25} />
//       </mesh>
//       <mesh position={[0, -0.15, 0.13]}>
//         <boxGeometry args={[0.6, 0.02, 0.02]} />
//         <meshStandardMaterial color="#C9C2AC" metalness={0.7} roughness={0.25} />
//       </mesh>
//     </group>
//   );
// }

// function TileStructure({ tile, buildLevel }: { tile: { type: TileType }; buildLevel?: number }) {
//   switch (tile.type) {
//     case "property":
//       return <PropertyStructure buildLevel={buildLevel} />;
//     case "estate":
//       return <PropertyStructure buildLevel={buildLevel} gold />;
//     case "contract":
//       return null; // paper asset — no built structure, label only
//     case "betting":
//       return <BettingWheel />;
//     case "tech_company":
//       return <TechTower />;
//     case "crypto":
//       return <CryptoCrystal />;
//     case "startup":
//       return <StartupRocket />;
//     case "bond":
//       return <BondVault />;
//     case "chance":
//       return <CardStanding deck="chance" />;
//     case "community":
//       return <CardStanding deck="community" />;
//     case "jail":
//       return <JailCage />;
//     default:
//       return null;
//   }
// }

// function CenterHub({ boardSize }: { boardSize: number }) {
//   const emblemRef = useRef<THREE.Mesh>(null);
//   const parchment = useMemo(() => parchmentTexture(), []);
//   const radius = Math.max(1.1, boardSize * 0.06);

//   useFrame((_, delta) => {
//     if (emblemRef.current) emblemRef.current.rotation.z += delta * 0.4;
//   });

//   return (
//     <group position={[0, 0, 0]}>
//       <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
//         <cylinderGeometry args={[radius, radius, 0.06, 6]} />
//         <meshStandardMaterial map={parchment} roughness={0.5} metalness={0.05} />
//       </mesh>
//       <mesh ref={emblemRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
//         <torusGeometry args={[radius * 0.4, radius * 0.06, 12, 32]} />
//         <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.55} />
//       </mesh>
//       {/* Chance deck — decorative, mirrors the corner card standee */}
//       <group position={[radius * 0.35, 0.08, radius * 0.35]} rotation={[0, -0.5, 0]}>
//         {[0, 1, 2].map((i) => (
//           <mesh key={i} position={[i * 0.015, i * 0.01, 0]} rotation={[0, 0, 0.08 * i]} castShadow>
//             <boxGeometry args={[0.18, 0.02, 0.24]} />
//             <meshStandardMaterial color="#E0A72E" roughness={0.5} />
//           </mesh>
//         ))}
//       </group>
//     </group>
//   );
// }

// function Tile({
//   tile,
//   spacing,
//   gx,
//   gy,
//   value,
//   visual,
//   onHover,
//   onSelect,
// }: {
//   tile: { id: string; type: TileType; name: string; basePrice: number };
//   spacing: number;
//   gx: number;
//   gy: number;
//   value: number;
//   visual?: TileVisualState;
//   onHover: (id: string | null) => void;
//   onSelect: (id: string) => void;
// }) {
//   const texture = useMemo(() => labelForTile(tile, value), [tile, value]);
//   const mortgaged = visual?.mortgaged;

//   return (
//     <group
//       position={[gx * spacing, 0, gy * spacing]}
//       onPointerOver={(e: ThreeEvent<PointerEvent>) => {
//         e.stopPropagation();
//         onHover(tile.id);
//       }}
//       onPointerOut={(e: ThreeEvent<PointerEvent>) => {
//         e.stopPropagation();
//         onHover(null);
//       }}
//       onClick={(e: ThreeEvent<MouseEvent>) => {
//         e.stopPropagation();
//         onSelect(tile.id);
//       }}
//     >
//       <mesh position={[0, 0.02, 0]} receiveShadow>
//         <boxGeometry args={[spacing * 0.82, 0.04, spacing * 0.82]} />
//         <meshStandardMaterial color={mortgaged ? "#C9C2AC" : "#FBF6E9"} roughness={0.65} />
//       </mesh>
//       <mesh position={[0, 0.041, -spacing * 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
//         <planeGeometry args={[spacing * 0.62, spacing * 0.62]} />
//         <meshStandardMaterial map={texture} transparent opacity={mortgaged ? 0.45 : 1} roughness={0.7} />
//       </mesh>
//       {/* Per-tile structures (houses, wheel, tower, etc.) commented out — they visually
//           collided with player tokens landing on the same tile, causing confusion between
//           the tile's own "piece" and the player's piece. The flat tile + printed label
//           (name/price) is enough to read the tile; re-enable if tokens get their own
//           dedicated parking spot offset away from tile center.
//       {!mortgaged && <TileStructure tile={tile} buildLevel={visual?.buildLevel} />} */}
//       {visual?.forSalePrice ? (
//         <mesh position={[spacing * 0.3, 0.4, spacing * 0.3]}>
//           <sphereGeometry args={[0.045, 8, 8]} />
//           <meshStandardMaterial color="#E0A72E" emissive="#E0A72E" emissiveIntensity={0.6} />
//         </mesh>
//       ) : null}
//     </group>
//   );
// }

// /** A single token that hops tile-by-tile ("like magic") from its previous tile to its new one. */
// function Token({
//   targetPosition,
//   total,
//   side,
//   spacing,
//   offset,
//   color,
//   inJail,
// }: {
//   targetPosition: number;
//   total: number;
//   side: number;
//   spacing: number;
//   offset: number;
//   color: string;
//   inJail: boolean;
// }) {
//   const ref = useRef<THREE.Mesh>(null);
//   const path = useRef<number[]>([targetPosition]);
//   const hopIndex = useRef(0);
//   const hopProgress = useRef(1);
//   const currentPos = useRef(targetPosition);
//   const scale = inJail ? 0.6 : 1;

//   const TILE_SURFACE_Y = 0.04; // top of the tile base mesh (boxGeometry height 0.04, centered at y=0.02)
//   const CONE_HEIGHT = 0.26;
//   const restY = TILE_SURFACE_Y + (CONE_HEIGHT / 2) * scale; // cone's own center, so its base actually touches the tile

//   const worldPos = (pos: number) => {
//     const [gx, gy] = tileLayoutPosition(pos, total, side);
//     const jailOffset = inJail && pos === jailPosition(side) ? -0.08 : 0;
//     return new THREE.Vector3(gx * spacing + offset, restY, gy * spacing + jailOffset);
//   };

//   useEffect(() => {
//     if (targetPosition === currentPos.current) return;
//     const walkable = isWalkableHop(currentPos.current, targetPosition, total);
//     path.current = walkable ? hopPath(currentPos.current, targetPosition, total) : [targetPosition];
//     hopIndex.current = 0;
//     hopProgress.current = 0;
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [targetPosition]);

//   useFrame((_, delta) => {
//     const mesh = ref.current;
//     if (!mesh) return;

//     if (hopProgress.current < 1) {
//       hopProgress.current = Math.min(1, hopProgress.current + delta / 0.25); // ~250ms per hop
//       const from = worldPos(currentPos.current);
//       const to = worldPos(path.current[hopIndex.current]);
//       const eased = hopProgress.current;
//       mesh.position.lerpVectors(from, to, eased);
//       mesh.position.y = from.y + Math.sin(eased * Math.PI) * 0.16; // arc bump — proportionate to resting near the tile surface
//       mesh.rotation.x = Math.sin(eased * Math.PI) * 0.6; // forward tumble

//       if (hopProgress.current >= 1) {
//         currentPos.current = path.current[hopIndex.current];
//         hopIndex.current += 1;
//         if (hopIndex.current < path.current.length) {
//           hopProgress.current = 0;
//         }
//       }
//     } else {
//       // idle bob + rotation when stationary
//       const t = performance.now() / 1000;
//       mesh.position.y = worldPos(currentPos.current).y + Math.sin(t * 2) * 0.02;
//       mesh.rotation.y += delta * 0.6;
//     }
//   });

//   return (
//     <mesh ref={ref} position={worldPos(targetPosition)} scale={scale} castShadow>
//       <coneGeometry args={[0.1, 0.26, 12]} />
//       <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
//     </mesh>
//   );
// }

// const DEMO_PLAYERS = [
//   { id: "demo1", userId: "demo1", username: "Demo", pieceId: "cone-gold" },
//   { id: "demo2", userId: "demo2", username: "Demo", pieceId: "cone-emerald" },
//   { id: "demo3", userId: "demo3", username: "Demo", pieceId: "cone-purple" },
// ];

// function buildDemoGame(): GameState {
//   const state = createInitialGameState(
//     "demo",
//     {
//       winCondition: "timed",
//       turnTimerSeconds: 45,
//       startingCapital: 3000,
//       boardVariant: "default",
//       boardSize: 10,
//       maxPlayers: 6,
//       marketEventEveryNTurns: 4,
//     },
//     DEMO_PLAYERS
//   );
//   // Scatter the demo tokens and a couple of owned tiles so the preview reads as "in play".
//   const idx = boardIndex(state.boardSize);
//   state.players.demo1.position = 3;
//   state.players.demo2.position = 14;
//   state.players.demo3.position = 24;
//   const ownable = idx.tiles.find((t) => state.tileMarket[t.id]);
//   if (ownable) {
//     state.tileMarket[ownable.id].ownerPlayerId = "demo1";
//     state.tileMarket[ownable.id].purchasePrice = ownable.basePrice;
//   }
//   return state;
// }

// /**
//  * One glowing "LED sign" panel standing up around the board's outer edge.
//  * Self-lit (meshBasicMaterial, toneMapped off) so it reads like an actual
//  * illuminated display regardless of the board's daylight lighting — not a
//  * painted-on ground texture. `texture` is cloned so each of the 4 walls can
//  * scroll independently even though they share the same source content.
//  */
// function TickerWall({
//   texture,
//   width,
//   height,
//   position,
//   rotationY,
//   speed,
//   bezelColor,
// }: {
//   texture: THREE.CanvasTexture;
//   width: number;
//   height: number;
//   position: [number, number, number];
//   rotationY: number;
//   speed: number;
//   bezelColor: string;
// }) {
//   const localTexture = useMemo(() => {
//     const t = texture.clone();
//     t.needsUpdate = true;
//     return t;
//   }, [texture]);

//   useFrame((_, delta) => {
//     localTexture.offset.x = (localTexture.offset.x + delta * speed + 1) % 1;
//   });

//   return (
//     <group position={position} rotation={[0, rotationY, 0]}>
//       <mesh position={[0, 0, -0.02]} receiveShadow castShadow>
//         <boxGeometry args={[width + 0.06, height + 0.06, 0.04]} />
//         <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.15} />
//       </mesh>
//       <mesh position={[0, 0, 0.001]}>
//         <planeGeometry args={[width, height]} />
//         <meshBasicMaterial map={localTexture} toneMapped={false} />
//       </mesh>
//     </group>
//   );
// }

// /**
//  * Four standing panels framing the board perimeter. Content is fully
//  * customizable via `messages` — defaults to the live game log, but any
//  * caller-supplied string list works (headlines, sponsor text, chat, etc).
//  * Changing `messages` regenerates the texture; nothing here is hardcoded
//  * to a fixed set of strings.
//  */
// function TickerRing({
//   boardHalf,
//   spacing,
//   messages,
//   color,
//   background,
//   bezelColor,
//   speed,
// }: {
//   boardHalf: number;
//   spacing: number;
//   messages: string[];
//   color: string;
//   background: string;
//   bezelColor: string;
//   speed: number;
// }) {
//   const distance = boardHalf + spacing * 0.5;
//   const length = boardHalf * 2 + spacing * 0.85;
//   const height = spacing * 0.12; // low, curb-height band — level with the board, not a tall enclosing wall

//   const texture = useMemo(() => tickerTexture(messages, color, background), [messages, color, background]);

//   return (
//     <group>
//       {/* rotationY + Math.PI on each: flips the panel to face outward, away from the
//           board, like real signage facing the crowd rather than the tiles. */}
//       <TickerWall texture={texture} width={length} height={height} position={[0, height / 2 + 0.02, -distance]} rotationY={Math.PI} speed={speed} bezelColor={bezelColor} />
//       <TickerWall texture={texture} width={length} height={height} position={[0, height / 2 + 0.02, distance]} rotationY={0} speed={speed} bezelColor={bezelColor} />
//       <TickerWall texture={texture} width={length} height={height} position={[distance, height / 2 + 0.02, 0]} rotationY={Math.PI / 2} speed={speed} bezelColor={bezelColor} />
//       <TickerWall texture={texture} width={length} height={height} position={[-distance, height / 2 + 0.02, 0]} rotationY={-Math.PI / 2} speed={speed} bezelColor={bezelColor} />
//     </group>
//   );
// }

// /** Default content source: recent real game activity. Overridable entirely via the `ticker` prop below. */
// function defaultTickerMessages(state: GameState): string[] {
//   if (state.log.length === 0) return ["Welcome to Gride", "Roll to begin"];
//   return state.log.slice(-10).map((entry) => entry.message);
// }

// export interface TickerOptions {
//   /** What to display. Defaults to recent game log entries if omitted. */
//   messages?: string[];
//   /** Show/hide the ticker walls entirely. Default true. */
//   enabled?: boolean;
//   color?: string; // text color, default gold
//   background?: string; // panel background, default near-black
//   bezelColor?: string; // frame color around the panel
//   speed?: number; // scroll speed, higher = faster
// }

// export default function Board3D({
//   game,
//   ticker,
//   onHoverTile,
//   onSelectTile,
// }: {
//   game?: GameState;
//   ticker?: TickerOptions;
//   onHoverTile?: (tileId: string | null) => void;
//   onSelectTile?: (tileId: string) => void;
// }) {
//   const demoGame = useMemo(() => (game ? null : buildDemoGame()), [game]);
//   const activeGame = game ?? demoGame!;
//   const idx = boardIndex(activeGame.boardSize);
//   const spacing = 0.9;
//   const extent = ((idx.tiles.length / 4) * spacing) / 2 + spacing;
//   const cameraDistance = Math.max(7, extent * 1.4);
//   const parchment = useMemo(() => parchmentTexture(), []);
//   const boardHalf = ((idx.boardSize - 1) / 2) * spacing;

//   const tickerEnabled = ticker?.enabled ?? true;
//   const tickerMessages = useMemo(
//     () => ticker?.messages ?? defaultTickerMessages(activeGame),
//     // Re-derive from the log only when its length or last entry actually changes, not on every render.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     [ticker?.messages, activeGame.log.length, activeGame.log[activeGame.log.length - 1]?.message]
//   );

//   const players: BoardPlayer[] = activeGame.playerOrder.map((pid) => ({
//     id: pid,
//     position: activeGame.players[pid].position,
//     pieceId: activeGame.players[pid].pieceId,
//     inJail: activeGame.players[pid].inJail,
//   }));

//   const byPosition = useMemo(() => {
//     const map = new Map<number, BoardPlayer[]>();
//     for (const p of players) {
//       const list = map.get(p.position) ?? [];
//       list.push(p);
//       map.set(p.position, list);
//     }
//     return map;
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [JSON.stringify(players)]);

//   return (
//     <div className="h-full w-full touch-none">
//       <Canvas
//         shadows
//         camera={{ position: [cameraDistance, cameraDistance * 0.9, cameraDistance], fov: 40 }}
//         gl={{
//           antialias: true,
//           toneMapping: THREE.ACESFilmicToneMapping,
//           toneMappingExposure: 1.5,
//           outputColorSpace: THREE.SRGBColorSpace,
//         }}
//       >
//         {/* Bright, warm daylight scene — a board on a tabletop, not a dark stage */}
//         <color attach="background" args={["#F2ECDA"]} />
//         <fog attach="fog" args={["#F2ECDA", extent * 3, extent * 6]} />

//         <hemisphereLight args={["#FFF8E7", "#DCCFA8", 0.95]} />
//         <ambientLight intensity={0.55} />
//         <directionalLight
//           position={[6, 9, 4]}
//           intensity={1.8}
//           color="#FFF6E0"
//           castShadow
//           shadow-mapSize={[2048, 2048]}
//           shadow-camera-left={-extent}
//           shadow-camera-right={extent}
//           shadow-camera-top={extent}
//           shadow-camera-bottom={-extent}
//         />
//         <directionalLight position={[-6, 5, -4]} intensity={0.5} color="#FDF3DE" />

//         <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
//           <planeGeometry args={[extent * 2.4, extent * 2.4]} />
//           <meshStandardMaterial map={parchment} roughness={0.75} />
//         </mesh>

//         <CenterHub boardSize={idx.boardSize} />

//         {tickerEnabled && (
//           <TickerRing
//             boardHalf={boardHalf}
//             spacing={spacing}
//             messages={tickerMessages}
//             color={ticker?.color ?? "#F0B94A"}
//             background={ticker?.background ?? "#14120F"}
//             bezelColor={ticker?.bezelColor ?? "#14120F"}
//             speed={ticker?.speed ?? 0.05}
//           />
//         )}

//         <group>
//           {idx.tiles.map((tile, i) => {
//             const [gx, gy] = tileLayoutPosition(i, idx.tiles.length, idx.boardSize);
//             const ts = activeGame.tileMarket[tile.id];
//             const value = ts ? tileCurrentValue(activeGame, tile.id) : 0;
//             const visual: TileVisualState | undefined = ts
//               ? { ownerPlayerId: ts.ownerPlayerId, buildLevel: ts.buildLevel, mortgaged: ts.mortgaged, forSalePrice: ts.forSalePrice }
//               : undefined;
//             return (
//               <Tile
//                 key={tile.id}
//                 tile={tile}
//                 spacing={spacing}
//                 gx={gx}
//                 gy={gy}
//                 value={value}
//                 visual={visual}
//                 onHover={(id) => onHoverTile?.(id)}
//                 onSelect={(id) => onSelectTile?.(id)}
//               />
//             );
//           })}
//         </group>

//         <group>
//           {Array.from(byPosition.entries()).flatMap(([, group]) =>
//             group.map((player, i) => {
//               const offset = (i - (group.length - 1) / 2) * (spacing * 0.18);
//               return (
//                 <Token
//                   key={player.id}
//                   targetPosition={player.position}
//                   total={idx.tiles.length}
//                   side={idx.boardSize}
//                   spacing={spacing}
//                   offset={offset}
//                   color={pieceColor(player.pieceId)}
//                   inJail={player.inJail}
//                 />
//               );
//             })
//           )}
//         </group>

//         {activeGame.lastRoll && <Dice3D rollId={activeGame.lastRoll.id} d1={activeGame.lastRoll.d1} d2={activeGame.lastRoll.d2} />}

//         <OrbitControls
//           enablePan={false}
//           enableZoom
//           enableRotate
//           enableDamping
//           dampingFactor={0.12}
//           minDistance={cameraDistance * 0.35}
//           maxDistance={cameraDistance * 2.2}
//           minPolarAngle={0.2}
//           maxPolarAngle={Math.PI / 2.15}
//           touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
//         />
//       </Canvas>
//     </div>
//   );
// }

























"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { boardIndex, hopPath, isWalkableHop, jailPosition, tileLayoutPosition } from "@/lib/game/board";
import { createInitialGameState, tileCurrentValue } from "@/lib/game/engine";
import type { GameState, TileType } from "@/lib/game/types";
import { pieceColor } from "@/components/PieceSelector";
import { tileLabelTexture, cornerLabelTexture, parchmentTexture, tickerTexture } from "./tileTextures";
import Dice3D from "./Dice3D";

// Bright, saturated "printed board game" accent colors — these sit on a
// cream card body (see tileTextures.ts), not glowing on a dark panel.
const TILE_COLOR: Record<TileType, string> = {
  go: "#C0392B",
  jail: "#8A7A5E",
  go_to_jail: "#A83232",
  exchange_floor: "#9C9078",
  chance: "#E0A72E",
  community: "#2E8B57",
  property: "#3C8F6D",
  estate: "#D4AF37",
  bond: "#4A9B7F",
  contract: "#D4AF37",
  betting: "#B23A2E",
  tech_company: "#7A4FB5",
  crypto: "#8A5FC7",
  startup: "#7A4FB5",
};

const CORNER_NAMES: Record<string, string> = {
  go: "START",
  jail: "JAIL",
  exchange_floor: "THE EXCHANGE",
  go_to_jail: "GO TO JAIL",
};

export interface BoardPlayer {
  id: string;
  position: number;
  pieceId: string;
  inJail: boolean;
}

export interface TileVisualState {
  ownerPlayerId: string | null;
  buildLevel?: number;
  mortgaged?: boolean;
  forSalePrice?: number | null;
}

// ---------- shared geometries (created once, reused across every tile) ----------
const HOUSE_BODY = new THREE.BoxGeometry(0.1, 0.09, 0.1);
const HOUSE_ROOF = new THREE.ConeGeometry(0.08, 0.07, 4);
const HOTEL_BODY = new THREE.BoxGeometry(0.22, 0.32, 0.22);
const HOTEL_CAP = new THREE.ConeGeometry(0.17, 0.14, 4);
const FLAG_POLE = new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6);
const FLAG = new THREE.PlaneGeometry(0.08, 0.05);

function labelForTile(tile: { type: TileType; name: string; basePrice: number; groupColor?: string }, value: number) {
  const isCorner = tile.type === "go" || tile.type === "jail" || tile.type === "exchange_floor" || tile.type === "go_to_jail";
  if (isCorner) return cornerLabelTexture(CORNER_NAMES[tile.type] ?? tile.name, TILE_COLOR[tile.type]);
  const subtitle = value > 0 ? `$${value.toLocaleString()}` : "";
  const accent = tile.groupColor ?? TILE_COLOR[tile.type];
  return tileLabelTexture(tile.name, subtitle, accent);
}

function PropertyStructure({ buildLevel = 0, gold = false }: { buildLevel?: number; gold?: boolean }) {
  if (buildLevel === 0) {
    return (
      <group position={[0, 0.09, 0]}>
        <mesh geometry={FLAG_POLE} position={[0, 0, 0]}>
          <meshStandardMaterial color="#B0A78C" roughness={0.5} metalness={0.2} />
        </mesh>
        <mesh geometry={FLAG} position={[0.04, 0.06, 0]}>
          <meshStandardMaterial color={gold ? "#D4AF37" : "#3C8F6D"} side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
      </group>
    );
  }
  if (buildLevel >= 5) {
    return (
      <group position={[0, 0.16, 0]}>
        <mesh geometry={HOTEL_BODY} position={[0, 0.16, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={gold ? "#F0D68A" : "#FBF6E9"} roughness={0.55} />
        </mesh>
        <mesh geometry={HOTEL_CAP} position={[0, 0.39, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <meshStandardMaterial color="#D4AF37" roughness={0.3} metalness={0.4} />
        </mesh>
      </group>
    );
  }
  const positions: [number, number][] = [
    [-0.06, -0.06],
    [0.06, -0.06],
    [-0.06, 0.06],
    [0.06, 0.06],
  ];
  return (
    <group position={[0, 0.08, 0]}>
      {positions.slice(0, buildLevel).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh geometry={HOUSE_BODY} position={[0, 0.045, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#FBF6E9" roughness={0.6} />
          </mesh>
          <mesh geometry={HOUSE_ROOF} position={[0, 0.125, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <meshStandardMaterial color={gold ? "#D4AF37" : "#3C8F6D"} roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BettingWheel() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 1.2;
  });
  return (
    <group position={[0, 0.1, 0]}>
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.17, 0.1, 16]} />
        <meshStandardMaterial color="#8A7355" roughness={0.55} metalness={0.1} />
      </mesh>
      <group ref={ref} position={[0, 0.08, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.02, 16, 1, false]} />
          <meshStandardMaterial color="#B23A2E" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.015, 0]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function TechTower() {
  return (
    <group position={[0, 0.22, 0]}>
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.44, 0.16]} />
        <meshPhysicalMaterial color="#A57FE0" transparent opacity={0.8} roughness={0.1} clearcoat={0.8} />
      </mesh>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.16, 6]} />
        <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.6} />
      </mesh>
    </group>
  );
}

function CryptoCrystal() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.elapsedTime * 0.6;
    ref.current.position.y = 0.24 + Math.sin(clock.elapsedTime * 1.4) * 0.03;
  });
  return (
    <mesh ref={ref} position={[0, 0.24, 0]} castShadow>
      <octahedronGeometry args={[0.13]} />
      <meshPhysicalMaterial color="#8A5FC7" roughness={0.15} clearcoat={0.6} transmission={0.15} />
    </mesh>
  );
}

function StartupRocket() {
  return (
    <group position={[0, 0.24, 0]}>
      <mesh position={[0, -0.06, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.07, 0.18, 10]} />
        <meshStandardMaterial color="#FBF6E9" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.06, 0]} castShadow>
        <coneGeometry args={[0.06, 0.14, 10]} />
        <meshStandardMaterial color="#7A4FB5" roughness={0.4} />
      </mesh>
    </group>
  );
}

function BondVault() {
  return (
    <group position={[0, 0.1, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.24, 0.2, 0.2]} />
        <meshStandardMaterial color="#4A9B7F" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.101]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.01, 16]} />
        <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.6} />
      </mesh>
    </group>
  );
}

function CardStanding({ deck }: { deck: "chance" | "community" }) {
  const texture = useMemo(() => tileLabelTexture(deck === "chance" ? "?" : "COMMUNITY", "", TILE_COLOR[deck]), [deck]);
  return (
    <group position={[0, 0.15, 0]}>
      <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.09, 0.1, 0.02, 12]} />
        <meshStandardMaterial color="#8A7355" roughness={0.5} />
      </mesh>
      <mesh castShadow>
        <planeGeometry args={[0.16, 0.2]} />
        <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.6} />
      </mesh>
    </group>
  );
}

function JailCage() {
  const bars = Array.from({ length: 7 }, (_, i) => -0.28 + (i * 0.56) / 6);
  return (
    <group position={[0, 0.16, -0.08]}>
      <mesh position={[0, 0, -0.14]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.32, 0.02]} />
        <meshStandardMaterial color="#B0A78C" roughness={0.6} />
      </mesh>
      <mesh position={[-0.3, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.02, 0.32, 0.28]} />
        <meshStandardMaterial color="#B0A78C" roughness={0.6} />
      </mesh>
      <mesh position={[0.3, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.02, 0.32, 0.28]} />
        <meshStandardMaterial color="#B0A78C" roughness={0.6} />
      </mesh>
      {bars.map((x, i) => (
        <mesh key={i} position={[x, 0, 0.13]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
          <meshStandardMaterial color="#C9C2AC" metalness={0.7} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 0.15, 0.13]}>
        <boxGeometry args={[0.6, 0.02, 0.02]} />
        <meshStandardMaterial color="#C9C2AC" metalness={0.7} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.15, 0.13]}>
        <boxGeometry args={[0.6, 0.02, 0.02]} />
        <meshStandardMaterial color="#C9C2AC" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  );
}

function TileStructure({ tile, buildLevel }: { tile: { type: TileType }; buildLevel?: number }) {
  switch (tile.type) {
    case "property":
      return <PropertyStructure buildLevel={buildLevel} />;
    case "estate":
      return <PropertyStructure buildLevel={buildLevel} gold />;
    case "contract":
      return null; // paper asset — no built structure, label only
    case "betting":
      return <BettingWheel />;
    case "tech_company":
      return <TechTower />;
    case "crypto":
      return <CryptoCrystal />;
    case "startup":
      return <StartupRocket />;
    case "bond":
      return <BondVault />;
    case "chance":
      return <CardStanding deck="chance" />;
    case "community":
      return <CardStanding deck="community" />;
    case "jail":
      return <JailCage />;
    default:
      return null;
  }
}

function CenterHub({ boardSize }: { boardSize: number }) {
  const emblemRef = useRef<THREE.Mesh>(null);
  const parchment = useMemo(() => parchmentTexture(), []);
  const radius = Math.max(1.1, boardSize * 0.06);

  useFrame((_, delta) => {
    if (emblemRef.current) emblemRef.current.rotation.z += delta * 0.4;
  });

  return (
    <group position={[0, 0, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <cylinderGeometry args={[radius, radius, 0.06, 6]} />
        <meshStandardMaterial map={parchment} roughness={0.5} metalness={0.05} />
      </mesh>
      <mesh ref={emblemRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[radius * 0.4, radius * 0.06, 12, 32]} />
        <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.55} />
      </mesh>
      {/* Chance deck — decorative, mirrors the corner card standee */}
      <group position={[radius * 0.35, 0.08, radius * 0.35]} rotation={[0, -0.5, 0]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[i * 0.015, i * 0.01, 0]} rotation={[0, 0, 0.08 * i]} castShadow>
            <boxGeometry args={[0.18, 0.02, 0.24]} />
            <meshStandardMaterial color="#E0A72E" roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function Tile({
  tile,
  spacing,
  gx,
  gy,
  value,
  visual,
  onHover,
  onSelect,
}: {
  tile: { id: string; type: TileType; name: string; basePrice: number; groupColor?: string };
  spacing: number;
  gx: number;
  gy: number;
  value: number;
  visual?: TileVisualState;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const texture = useMemo(() => labelForTile(tile, value), [tile, value]);
  const mortgaged = visual?.mortgaged;

  return (
    <group
      position={[gx * spacing, 0, gy * spacing]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(tile.id);
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHover(null);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        onSelect(tile.id);
      }}
    >
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[spacing * 0.82, 0.04, spacing * 0.82]} />
        <meshStandardMaterial color={mortgaged ? "#C9C2AC" : "#FBF6E9"} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.041, -spacing * 0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[spacing * 0.62, spacing * 0.62]} />
        <meshStandardMaterial map={texture} transparent opacity={mortgaged ? 0.45 : 1} roughness={0.7} />
      </mesh>
      {/* Only show a structure once a property/estate is actually built — this is a
          meaningful gameplay signal players need to see. Every other decorative
          structure (betting wheel, tech tower, crypto crystal, rocket, vault, cards,
          jail cage) stays off since those visually collided with player tokens
          landing on the same tile. The flag-pole placeholder for an unbuilt
          property is also skipped for the same reason. */}
      {!mortgaged && (tile.type === "property" || tile.type === "estate") && (visual?.buildLevel ?? 0) > 0 && (
        <TileStructure tile={tile} buildLevel={visual?.buildLevel} />
      )}
      {visual?.forSalePrice ? (
        <mesh position={[spacing * 0.3, 0.4, spacing * 0.3]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshStandardMaterial color="#E0A72E" emissive="#E0A72E" emissiveIntensity={0.6} />
        </mesh>
      ) : null}
    </group>
  );
}

/** A single token that hops tile-by-tile ("like magic") from its previous tile to its new one. */
function Token({
  targetPosition,
  total,
  side,
  spacing,
  offset,
  color,
  inJail,
}: {
  targetPosition: number;
  total: number;
  side: number;
  spacing: number;
  offset: number;
  color: string;
  inJail: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const path = useRef<number[]>([targetPosition]);
  const hopIndex = useRef(0);
  const hopProgress = useRef(1);
  const currentPos = useRef(targetPosition);
  const scale = inJail ? 0.6 : 1;

  const TILE_SURFACE_Y = 0.06; // top of the tile base mesh (boxGeometry height 0.04, centered at y=0.02)
  const CONE_HEIGHT = 0.26;
  const restY = TILE_SURFACE_Y + (CONE_HEIGHT / 2) * scale; // cone's own center, so its base actually touches the tile

  const worldPos = (pos: number) => {
    const [gx, gy] = tileLayoutPosition(pos, total, side);
    const jailOffset = inJail && pos === jailPosition(side) ? -0.08 : 0;
    return new THREE.Vector3(gx * spacing + offset, restY, gy * spacing + jailOffset);
  };

  useEffect(() => {
    const isAnimating = hopProgress.current < 1 && hopIndex.current < path.current.length;
    // If mid-hop, chain from wherever the queued path will actually end up —
    // never recompute from a stale reference, or the hop count could stop
    // matching the real distance traveled.
    const effectiveFrom = isAnimating ? path.current[path.current.length - 1] : currentPos.current;
    if (targetPosition === effectiveFrom) return;

    const walkable = isWalkableHop(effectiveFrom, targetPosition, total);
    const newLeg = walkable ? hopPath(effectiveFrom, targetPosition, total) : [targetPosition];

    if (isAnimating) {
      path.current = [...path.current, ...newLeg]; // extend the queue seamlessly, don't interrupt the current hop
    } else {
      currentPos.current = effectiveFrom;
      path.current = newLeg;
      hopIndex.current = 0;
      hopProgress.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetPosition]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;

    if (hopProgress.current < 1) {
      hopProgress.current = Math.min(1, hopProgress.current + delta / 0.25); // ~250ms per hop
      const from = worldPos(currentPos.current);
      const to = worldPos(path.current[hopIndex.current]);
      const eased = hopProgress.current;
      mesh.position.lerpVectors(from, to, eased);
      mesh.position.y = from.y + Math.sin(eased * Math.PI) * 0.16; // arc bump — proportionate to resting near the tile surface
      mesh.rotation.x = Math.sin(eased * Math.PI) * 0.6; // forward tumble

      if (hopProgress.current >= 1) {
        currentPos.current = path.current[hopIndex.current];
        hopIndex.current += 1;
        if (hopIndex.current < path.current.length) {
          hopProgress.current = 0;
        }
      }
    } else {
      // idle bob + rotation when stationary
      const t = performance.now() / 1000;
      mesh.position.y = worldPos(currentPos.current).y + Math.sin(t * 2) * 0.02;
      mesh.rotation.y += delta * 0.6;
    }
  });

  return (
    <mesh ref={ref} position={worldPos(targetPosition)} scale={scale} castShadow>
      <coneGeometry args={[0.1, 0.26, 12]} />
      <meshStandardMaterial color={color} roughness={0.35} metalness={0.15} />
    </mesh>
  );
}

const DEMO_PLAYERS = [
  { id: "demo1", userId: "demo1", username: "Demo", pieceId: "cone-gold" },
  { id: "demo2", userId: "demo2", username: "Demo", pieceId: "cone-emerald" },
  { id: "demo3", userId: "demo3", username: "Demo", pieceId: "cone-purple" },
];

function buildDemoGame(): GameState {
  const state = createInitialGameState(
    "demo",
    {
      winCondition: "timed",
      turnTimerSeconds: 45,
      startingCapital: 3000,
      boardVariant: "default",
      boardSize: 10,
      maxPlayers: 6,
      marketEventEveryNTurns: 4,
    },
    DEMO_PLAYERS
  );
  // Scatter the demo tokens and a couple of owned tiles so the preview reads as "in play".
  const idx = boardIndex(state.boardSize);
  state.players.demo1.position = 3;
  state.players.demo2.position = 14;
  state.players.demo3.position = 24;
  const ownable = idx.tiles.find((t) => state.tileMarket[t.id]);
  if (ownable) {
    state.tileMarket[ownable.id].ownerPlayerId = "demo1";
    state.tileMarket[ownable.id].purchasePrice = ownable.basePrice;
  }
  return state;
}

/**
 * One glowing "LED sign" panel standing up around the board's outer edge.
 * Self-lit (meshBasicMaterial, toneMapped off) so it reads like an actual
 * illuminated display regardless of the board's daylight lighting — not a
 * painted-on ground texture. `texture` is cloned so each of the 4 walls can
 * scroll independently even though they share the same source content.
 */
function TickerWall({
  texture,
  width,
  height,
  position,
  rotationY,
  speed,
  bezelColor,
}: {
  texture: THREE.CanvasTexture;
  width: number;
  height: number;
  position: [number, number, number];
  rotationY: number;
  speed: number;
  bezelColor: string;
}) {
  const localTexture = useMemo(() => {
    const t = texture.clone();
    t.needsUpdate = true;
    return t;
  }, [texture]);

  useFrame((_, delta) => {
    localTexture.offset.x = (localTexture.offset.x + delta * speed + 1) % 1;
  });

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, -0.02]} receiveShadow castShadow>
        <boxGeometry args={[width + 0.06, height + 0.06, 0.04]} />
        <meshStandardMaterial color={bezelColor} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0, 0.001]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={localTexture} toneMapped={false} />
      </mesh>
    </group>
  );
}

/**
 * Four standing panels framing the board perimeter. Content is fully
 * customizable via `messages` — defaults to the live game log, but any
 * caller-supplied string list works (headlines, sponsor text, chat, etc).
 * Changing `messages` regenerates the texture; nothing here is hardcoded
 * to a fixed set of strings.
 */
function TickerRing({
  boardHalf,
  spacing,
  messages,
  color,
  background,
  bezelColor,
  speed,
}: {
  boardHalf: number;
  spacing: number;
  messages: string[];
  color: string;
  background: string;
  bezelColor: string;
  speed: number;
}) {
  const distance = boardHalf + spacing * 0.5;
  const length = boardHalf * 2 + spacing * 0.85;
  const height = spacing * 0.12; // low, curb-height band — level with the board, not a tall enclosing wall

  const texture = useMemo(() => tickerTexture(messages, color, background), [messages, color, background]);

  return (
    <group>
      {/* rotationY + Math.PI on each: flips the panel to face outward, away from the
          board, like real signage facing the crowd rather than the tiles. */}
      <TickerWall texture={texture} width={length} height={height} position={[0, height / 2 + 0.02, -distance]} rotationY={Math.PI} speed={speed} bezelColor={bezelColor} />
      <TickerWall texture={texture} width={length} height={height} position={[0, height / 2 + 0.02, distance]} rotationY={0} speed={speed} bezelColor={bezelColor} />
      <TickerWall texture={texture} width={length} height={height} position={[distance, height / 2 + 0.02, 0]} rotationY={Math.PI / 2} speed={speed} bezelColor={bezelColor} />
      <TickerWall texture={texture} width={length} height={height} position={[-distance, height / 2 + 0.02, 0]} rotationY={-Math.PI / 2} speed={speed} bezelColor={bezelColor} />
    </group>
  );
}

/** Default content source: recent real game activity. Overridable entirely via the `ticker` prop below. */
function defaultTickerMessages(state: GameState): string[] {
  if (state.log.length === 0) return ["Welcome to Gride", "Roll to begin"];
  return state.log.slice(-10).map((entry) => entry.message);
}

export interface TickerOptions {
  /** What to display. Defaults to recent game log entries if omitted. */
  messages?: string[];
  /** Show/hide the ticker walls entirely. Default true. */
  enabled?: boolean;
  color?: string; // text color, default gold
  background?: string; // panel background, default near-black
  bezelColor?: string; // frame color around the panel
  speed?: number; // scroll speed, higher = faster
}

export default function Board3D({
  game,
  ticker,
  onHoverTile,
  onSelectTile,
}: {
  game?: GameState;
  ticker?: TickerOptions;
  onHoverTile?: (tileId: string | null) => void;
  onSelectTile?: (tileId: string) => void;
}) {
  const demoGame = useMemo(() => (game ? null : buildDemoGame()), [game]);
  const activeGame = game ?? demoGame!;
  const idx = boardIndex(activeGame.boardSize);
  const spacing = 0.9;
  const extent = ((idx.tiles.length / 4) * spacing) / 2 + spacing;
  const cameraDistance = Math.max(7, extent * 1.4);
  const parchment = useMemo(() => parchmentTexture(), []);
  const boardHalf = ((idx.boardSize - 1) / 2) * spacing;

  const tickerEnabled = ticker?.enabled ?? true;
  const tickerMessages = useMemo(
    () => ticker?.messages ?? defaultTickerMessages(activeGame),
    // Re-derive from the log only when its length or last entry actually changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ticker?.messages, activeGame.log.length, activeGame.log[activeGame.log.length - 1]?.message]
  );

  const players: BoardPlayer[] = activeGame.playerOrder.map((pid) => ({
    id: pid,
    position: activeGame.players[pid].position,
    pieceId: activeGame.players[pid].pieceId,
    inJail: activeGame.players[pid].inJail,
  }));

  const byPosition = useMemo(() => {
    const map = new Map<number, BoardPlayer[]>();
    for (const p of players) {
      const list = map.get(p.position) ?? [];
      list.push(p);
      map.set(p.position, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(players)]);

  return (
    <div className="h-full w-full touch-none">
      <Canvas
        shadows
        camera={{ position: [cameraDistance, cameraDistance * 0.9, cameraDistance], fov: 40 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        {/* Bright, warm daylight scene — a board on a tabletop, not a dark stage */}
        <color attach="background" args={["#F2ECDA"]} />
        <fog attach="fog" args={["#F2ECDA", extent * 3, extent * 6]} />

        <hemisphereLight args={["#FFF8E7", "#DCCFA8", 0.95]} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[6, 9, 4]}
          intensity={1.8}
          color="#FFF6E0"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-extent}
          shadow-camera-right={extent}
          shadow-camera-top={extent}
          shadow-camera-bottom={-extent}
        />
        <directionalLight position={[-6, 5, -4]} intensity={0.5} color="#FDF3DE" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.02, 0]}>
          <planeGeometry args={[extent * 2.4, extent * 2.4]} />
          <meshStandardMaterial map={parchment} roughness={0.75} />
        </mesh>

        <CenterHub boardSize={idx.boardSize} />

        {tickerEnabled && (
          <TickerRing
            boardHalf={boardHalf}
            spacing={spacing}
            messages={tickerMessages}
            color={ticker?.color ?? "#F0B94A"}
            background={ticker?.background ?? "#14120F"}
            bezelColor={ticker?.bezelColor ?? "#14120F"}
            speed={ticker?.speed ?? 0.05}
          />
        )}

        <group>
          {idx.tiles.map((tile, i) => {
            const [gx, gy] = tileLayoutPosition(i, idx.tiles.length, idx.boardSize);
            const ts = activeGame.tileMarket[tile.id];
            const value = ts ? tileCurrentValue(activeGame, tile.id) : 0;
            const visual: TileVisualState | undefined = ts
              ? { ownerPlayerId: ts.ownerPlayerId, buildLevel: ts.buildLevel, mortgaged: ts.mortgaged, forSalePrice: ts.forSalePrice }
              : undefined;
            return (
              <Tile
                key={tile.id}
                tile={tile}
                spacing={spacing}
                gx={gx}
                gy={gy}
                value={value}
                visual={visual}
                onHover={(id) => onHoverTile?.(id)}
                onSelect={(id) => onSelectTile?.(id)}
              />
            );
          })}
        </group>

        <group>
          {Array.from(byPosition.entries()).flatMap(([, group]) =>
            group.map((player, i) => {
              const offset = (i - (group.length - 1) / 2) * (spacing * 0.18);
              return (
                <Token
                  key={player.id}
                  targetPosition={player.position}
                  total={idx.tiles.length}
                  side={idx.boardSize}
                  spacing={spacing}
                  offset={offset}
                  color={pieceColor(player.pieceId)}
                  inJail={player.inJail}
                />
              );
            })
          )}
        </group>

        {activeGame.lastRoll && <Dice3D rollId={activeGame.lastRoll.id} d1={activeGame.lastRoll.d1} d2={activeGame.lastRoll.d2} />}

        <OrbitControls
          enablePan={false}
          enableZoom
          enableRotate
          enableDamping
          dampingFactor={0.12}
          minDistance={cameraDistance * 0.35}
          maxDistance={cameraDistance * 2.2}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.15}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      </Canvas>
    </div>
  );
}
