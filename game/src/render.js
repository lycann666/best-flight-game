// render.js — the chase view: golden-hour sky, sea, islands, strips, rings and the plane.
// Pseudo-3D: world points are projected through a camera trailing behind the plane.
// One file, one job: everything drawn in the 3D scene (the HUD lives in hud.js).
import { CONFIG } from './config.js';
import { clamp, lerp, degToRad, wrapAngle } from './random.js';

const FT_TO_M = 0.3048;

// Project a world point (metres, y in metres) into screen space.
// Returns { x, y, scale, dist } or null when behind the camera.
function makeProjector(plane, W, H) {
  const heading = degToRad(plane.heading);
  const fx = Math.sin(heading); // forward, +x east
  const fz = -Math.cos(heading); // forward, -z north
  const rx = -fz; // right vector (x)
  const rz = fx;  // right vector (z)
  const px = plane.x - fx * CONFIG.camBack;
  const pz = plane.z - fz * CONFIG.camBack;
  const py = plane.y * FT_TO_M + CONFIG.camUp;
  const cx = W / 2;
  const horizonY = H * 0.44;
  const focal = CONFIG.focal * (W / 1280);
  return function project(wx, wyM, wz) {
    const dx = wx - px, dy = wyM - py, dz = wz - pz;
    const fwd = dx * fx + dz * fz;
    if (fwd < 6) return null;
    const right = dx * rx + dz * rz;
    const scale = focal / fwd;
    return {
      x: cx + right * scale,
      y: horizonY - dy * scale,
      scale,
      dist: fwd,
      horizonY,
    };
  };
}

function hazeAlpha(dist) {
  return clamp(1 - dist / CONFIG.fogFar, 0.15, 1);
}

// Mix a hex colour toward the haze colour by t (0 = full colour, 1 = haze).
function mixHex(hex, t) {
  const haze = [247, 200, 115];
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const m = (a, b2) => Math.round(lerp(a, b2, t));
  return `rgb(${m(r, haze[0])},${m(g, haze[1])},${m(b, haze[2])})`;
}

export function drawScene(ctx, state, W, H, timeMs) {
  const { world, plane } = state;
  const t = timeMs / 1000;

  // --- Sky: vertical gradient, golden hour. ---
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55);
  sky.addColorStop(0, CONFIG.skyTop);
  sky.addColorStop(0.55, CONFIG.skyMid);
  sky.addColorStop(1, CONFIG.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.55 + 2);

  // --- Sun: low in the west; its screen position follows the heading. ---
  const sunAz = 270; // degrees, west
  const rel = wrapAngle(sunAz - plane.heading); // 0 = dead ahead
  const sunX = W / 2 + Math.sin(degToRad(rel)) * W * 0.62;
  const sunY = H * 0.30 - Math.cos(degToRad(rel)) * H * 0.06;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
  glow.addColorStop(0, 'rgba(255, 225, 150, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 190, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
  ctx.fillStyle = CONFIG.sunColor;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();

  // --- Sea: gradient from horizon glow down to deep turquoise. ---
  const horizonY = H * 0.44;
  const sea = ctx.createLinearGradient(0, horizonY, 0, H);
  sea.addColorStop(0, '#e8a35f');
  sea.addColorStop(0.12, CONFIG.seaShallow);
  sea.addColorStop(1, CONFIG.seaDeep);
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, W, H - horizonY);

  // Sun glitter on the water, under the sun.
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 26; i++) {
    const yy = horizonY + 8 + i * i * 0.55;
    const wdt = 30 + i * 9 + Math.sin(t * 2 + i) * 8;
    ctx.fillStyle = 'rgba(255, 220, 140, 0.28)';
    ctx.fillRect(sunX - wdt / 2, yy, wdt, 2);
  }
  ctx.restore();

  const project = makeProjector(plane, W, H);

  // --- Islands, far to near, with haze. ---
  const islands = world.islands
    .map((isl) => ({ isl, d: Math.hypot(isl.x - plane.x, isl.z - plane.z) }))
    .filter((o) => o.d < CONFIG.fogFar + 1500)
    .sort((a, b) => b.d - a.d);
  for (const { isl, d } of islands) {
    const base = project(isl.x, 0, isl.z);
    const peak = project(isl.x, isl.peak * FT_TO_M, isl.z);
    if (!base || !peak) continue;
    const wHalf = isl.r * base.scale;
    if (wHalf < 2) continue;
    const haze = 1 - hazeAlpha(d);
    const green = mixHex(isl.volcano ? '#3f7a3a' : '#2e8a4a', haze);
    const dark = mixHex('#1d5c2e', haze);
    const sand = mixHex('#e8d29a', haze);
    // Beach: a sandy rim; the island itself stays green underneath.
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, wHalf, Math.max(3, wHalf * 0.14), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mixHex('#2e7a40', haze);
    ctx.beginPath();
    ctx.ellipse(base.x, base.y, wHalf * 0.88, Math.max(2, wHalf * 0.11), 0, 0, Math.PI * 2);
    ctx.fill();
    // Volcanic cone / green hill.
    const grad = ctx.createLinearGradient(0, peak.y, 0, base.y);
    grad.addColorStop(0, mixHex(isl.volcano ? '#5a5148' : '#4fae62', haze));
    grad.addColorStop(0.7, green);
    grad.addColorStop(1, dark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(base.x - wHalf, base.y);
    ctx.quadraticCurveTo(base.x - wHalf * 0.45, peak.y + (base.y - peak.y) * 0.55, peak.x, peak.y);
    ctx.quadraticCurveTo(base.x + wHalf * 0.45, peak.y + (base.y - peak.y) * 0.55, base.x + wHalf, base.y);
    ctx.closePath();
    ctx.fill();
    // Snow/ash cap on the volcano, jungle speckle on the rest.
    if (isl.volcano) {
      ctx.fillStyle = mixHex('#d8cfc4', haze);
      ctx.beginPath();
      ctx.moveTo(peak.x - wHalf * 0.12, peak.y + (base.y - peak.y) * 0.10);
      ctx.lineTo(peak.x, peak.y);
      ctx.lineTo(peak.x + wHalf * 0.12, peak.y + (base.y - peak.y) * 0.10);
      ctx.closePath();
      ctx.fill();
      // Smoke drifting from the crater.
      ctx.save();
      ctx.globalAlpha = 0.5 * (1 - haze * 0.5);
      ctx.fillStyle = '#cfc8bd';
      for (let s = 0; s < 3; s++) {
        const sx = peak.x + 14 + s * 16 + Math.sin(t * 0.7 + s) * 6;
        const sy = peak.y - 10 - s * 14;
        ctx.beginPath();
        ctx.arc(sx, sy, 7 + s * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Island name above the summit, only for islands at a readable distance
    // (near islands are identified by their strip or ring instead).
    if (d > 1500 && d < 5200 && wHalf > 60) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff8e6';
      ctx.font = `600 ${Math.max(11, Math.min(15, wHalf * 0.09))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(isl.name, peak.x, peak.y - 16);
      ctx.restore();
    }
  }

  // --- Clouds: soft white puffs drifting over the sea. ---
  for (const c of world.clouds) {
    const p = project(c.x, c.y * FT_TO_M, c.z);
    if (!p) continue;
    const wdt = c.s * p.scale;
    if (wdt < 4) continue;
    ctx.save();
    ctx.globalAlpha = c.a * hazeAlpha(p.dist);
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, wdt, wdt * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(p.x - wdt * 0.4, p.y + wdt * 0.06, wdt * 0.6, wdt * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawStrips(ctx, state, project, W, H);
  drawRings(ctx, state, project, W, H, t);
  drawBeacon(ctx, state, project, W, H, t);

  // --- The plane: "Cendrawasih-9", drawn big and readable in the chase view.
  // On the title screen it sits smaller and lower so it never covers the cards.
  drawPlane(ctx, plane, W, H, t, state.screen === 'title');
}

function drawStrips(ctx, state, project, W, H) {
  const { world } = state;
  for (const strip of world.strips) {
    const hRad = degToRad(strip.heading);
    const fx = Math.sin(hRad), fz = -Math.cos(hRad);
    const rx = -fz, rz = fx;
    const halfL = strip.length / 2, halfW = strip.width / 2;
    const gy = stripHeightFor(state, strip);
    const corners = [
      project(strip.x - fx * halfL - rx * halfW, gy, strip.z - fz * halfL - rz * halfW),
      project(strip.x + fx * halfL - rx * halfW, gy, strip.z + fz * halfL - rz * halfW),
      project(strip.x + fx * halfL + rx * halfW, gy, strip.z + fz * halfL + rz * halfW),
      project(strip.x - fx * halfL + rx * halfW, gy, strip.z - fz * halfL + rz * halfW),
    ];
    if (corners.some((c) => !c)) continue;
    ctx.save();
    ctx.fillStyle = 'rgba(52, 48, 44, 0.92)';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 12]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x + (corners[3].x - corners[0].x) / 2, corners[0].y + (corners[3].y - corners[0].y) / 2);
    ctx.lineTo(corners[1].x + (corners[2].x - corners[1].x) / 2, corners[1].y + (corners[2].y - corners[1].y) / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Strip name label at the far end, above the strip so it never covers the runway.
    const far = project(strip.x + fx * halfL, gy, strip.z + fz * halfL);
    if (far && far.dist < 6000 && far.dist > 350) {
      ctx.fillStyle = '#fff2cf';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(strip.name, far.x, far.y - 26);
    }
    ctx.restore();
  }
}

function stripHeightFor(state, strip) {
  // Strips sit on levelled pads: reuse the island height at the strip centre.
  return state._stripHeights[strip.name] * FT_TO_M;
}

function drawRings(ctx, state, project, W, H, t) {
  const rings = (state.mission && state.mission.rings) || [];
  const nextIdx = rings.findIndex((r) => !r.passed);
  for (const ring of rings) {
    const p = project(ring.x, ring.y * FT_TO_M, ring.z);
    if (!p) continue;
    const rad = ring.r * p.scale;
    if (rad < 3) continue;
    const isNext = ring.index === nextIdx;
    const color = ring.passed ? '#39d98a' : isNext ? '#ffcf3f' : '#7fd8ff';
    ctx.save();
    ctx.globalAlpha = clamp(hazeAlpha(p.dist) + 0.25, 0.3, 1);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, rad * 0.09);
    ctx.shadowColor = color;
    ctx.shadowBlur = isNext ? 18 + Math.sin(t * 4) * 6 : 10;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rad, rad * 0.92, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha *= 0.5;
    ctx.lineWidth = Math.max(1, rad * 0.03);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rad * 0.62, rad * 0.57, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (isNext) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff2cf';
      ctx.font = `700 ${Math.max(12, Math.min(18, rad * 0.3))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('RING ' + (ring.index + 1), p.x, p.y - rad - 10);
    }
    ctx.restore();
  }
}

function drawBeacon(ctx, state, project, W, H, t) {
  const beacon = state.mission && state.mission.beacon;
  if (!beacon) return;
  const b = beacon;
  const p = project(b.x, b.y * FT_TO_M, b.z);
  if (!p) return;
  const pulse = 0.6 + 0.4 * Math.sin(t * 5);
  ctx.save();
  ctx.globalAlpha = clamp(hazeAlpha(p.dist) + 0.2, 0.3, 1);
  const g = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 60 * pulse);
  g.addColorStop(0, 'rgba(255, 90, 90, 0.9)');
  g.addColorStop(1, 'rgba(255, 90, 90, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(p.x - 70, p.y - 70, 140, 140);
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 7 * pulse + 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff2cf';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RESCUE BEACON', p.x, p.y - 26);
  ctx.restore();
}

// The bush plane, drawn in 2D at a fixed chase-view spot, banked with the wings.
export function drawPlane(ctx, plane, W, H, t, titleMode = false) {
  const px = W / 2;
  const py = titleMode ? H * 0.86 : H * 0.68;
  const scale = (W / 1280) * (titleMode ? 0.62 : 1);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(degToRad(-plane.bank * 0.55));
  ctx.scale(scale, scale);
  // Soft shadow on the water below when low.
  if (plane.y < 600) {
    ctx.save();
    ctx.globalAlpha = clamp(0.35 - plane.y / 2000, 0.05, 0.35);
    ctx.fillStyle = '#062a33';
    ctx.beginPath();
    ctx.ellipse(0, 150, 150, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Tail.
  ctx.fillStyle = '#b3402e';
  ctx.beginPath();
  ctx.moveTo(-150, -6); ctx.lineTo(-196, -44); ctx.lineTo(-176, -44); ctx.lineTo(-128, -10);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#8f2f20';
  ctx.beginPath();
  ctx.moveTo(-150, 8); ctx.lineTo(-192, 34); ctx.lineTo(-172, 38); ctx.lineTo(-126, 12);
  ctx.closePath(); ctx.fill();
  // Main wing (seen from behind-above, slightly swept).
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.moveTo(-30, -14); ctx.lineTo(-215, -58); ctx.lineTo(-225, -40); ctx.lineTo(-40, 6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, -14); ctx.lineTo(215, -58); ctx.lineTo(225, -40); ctx.lineTo(40, 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#c94f38';
  ctx.fillRect(-225, -52, 22, 10);
  ctx.fillRect(203, -52, 22, 10);
  // Fuselage.
  const body = ctx.createLinearGradient(0, -26, 0, 26);
  body.addColorStop(0, '#fdf6e3');
  body.addColorStop(0.5, '#f3e3b8');
  body.addColorStop(1, '#c9a86a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(150, 0);
  ctx.quadraticCurveTo(120, -26, 30, -24);
  ctx.lineTo(-140, -18);
  ctx.quadraticCurveTo(-175, -14, -178, 0);
  ctx.quadraticCurveTo(-175, 14, -140, 18);
  ctx.lineTo(30, 24);
  ctx.quadraticCurveTo(120, 26, 150, 0);
  ctx.closePath();
  ctx.fill();
  // Red cheatline + name.
  ctx.fillStyle = '#c94f38';
  ctx.fillRect(-140, 2, 250, 7);
  ctx.fillStyle = '#5a3a1a';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CENDRAWASIH-9', -20, -30);
  // Cockpit windows.
  ctx.fillStyle = '#1d4e5e';
  ctx.beginPath();
  ctx.moveTo(52, -20); ctx.lineTo(96, -14); ctx.lineTo(96, -2); ctx.lineTo(52, -6);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(48, -20); ctx.lineTo(20, -21); ctx.lineTo(20, -6); ctx.lineTo(48, -6);
  ctx.closePath(); ctx.fill();
  // Propeller blur (spins faster with throttle).
  const spin = plane.throttle > 0.05;
  ctx.save();
  ctx.translate(152, 0);
  ctx.globalAlpha = spin ? 0.5 : 0.25;
  ctx.fillStyle = '#d8d2c2';
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 62 + plane.throttle * 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a332a';
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Landing gear when on the ground.
  if (plane.onGround) {
    ctx.strokeStyle = '#3a332a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-60, 22); ctx.lineTo(-66, 44);
    ctx.moveTo(60, 22); ctx.lineTo(66, 44);
    ctx.stroke();
    ctx.fillStyle = '#22201c';
    ctx.beginPath();
    ctx.arc(-66, 48, 9, 0, Math.PI * 2);
    ctx.arc(66, 48, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
