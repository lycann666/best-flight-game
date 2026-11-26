// hud.js — the amber-lit instrument panel: ALT, SPD, HDG + compass tape,
// fuel, damage, artificial horizon, turn coordinator, objective, timer, score.
// One file, one job: everything drawn on top of the scene.
import { CONFIG } from './config.js';
import { clamp, wrapAngle } from './random.js';

const AMBER = '#ffb347';
const AMBER_DIM = '#c98a2e';
const PANEL = 'rgba(20, 16, 10, 0.72)';
const PANEL_EDGE = 'rgba(255, 179, 71, 0.45)';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, size = 11) {
  ctx.fillStyle = AMBER_DIM;
  ctx.font = `700 ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size = 26) {
  ctx.fillStyle = '#ffe9b0';
  ctx.font = `700 ${size}px "SF Mono", ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(text, x, y);
}

export function drawHUD(ctx, state, W, H) {
  const { plane, mission } = state;
  const m = 14; // margin

  // --- Top-left: ALT / SPD / HDG. ---
  panel(ctx, m, m, 300, 96);
  label(ctx, 'ALT · FT', m + 14, m + 20);
  value(ctx, String(Math.round(plane.y)).padStart(5, '0'), m + 14, m + 48);
  label(ctx, 'SPD · KT', m + 150, m + 20);
  value(ctx, String(Math.round(plane.speedKt)).padStart(3, '0'), m + 150, m + 48);
  label(ctx, 'HDG', m + 14, m + 76);
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '700 16px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText(String(Math.round(wrapAngle(plane.heading))).padStart(3, '0') + '°', m + 62, m + 78);
  // Vertical speed arrow.
  const vs = plane.verticalSpeedFpm;
  ctx.fillStyle = vs > 40 ? '#7dff9a' : vs < -40 ? '#ff7d6e' : AMBER_DIM;
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.fillText(vs > 40 ? '▲ +' + Math.round(vs) + ' fpm' : vs < -40 ? '▼ ' + Math.round(vs) + ' fpm' : '— level', m + 150, m + 78);

  // --- Compass tape across the top. ---
  drawCompass(ctx, plane.heading, W, 12);

  // --- Top-right: objective, timer, score. ---
  panel(ctx, W - 314, m, 300, 96);
  label(ctx, 'MISSION · ' + mission.def.name.toUpperCase(), W - 300, m + 20);
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(state.objectiveText, W - 300, m + 44, 272);
  const timeLeft = Math.max(0, mission.def.timeLimitSec - mission.elapsedSec);
  const mm = Math.floor(timeLeft / 60);
  const ss = Math.floor(timeLeft % 60);
  ctx.fillStyle = timeLeft < 60 ? '#ff7d6e' : '#ffe9b0';
  ctx.font = '700 18px ui-monospace, monospace';
  ctx.fillText('⏱ ' + mm + ':' + String(ss).padStart(2, '0'), W - 300, m + 70);
  ctx.fillStyle = AMBER;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('SCORE  ' + state.score, W - 168, m + 70);

  // --- Bottom-left: artificial horizon + turn coordinator. ---
  panel(ctx, m, H - 128, 190, 114);
  drawHorizon(ctx, m + 58, H - 71, 44, plane.bank, plane.pitch);
  label(ctx, 'ATTITUDE', m + 118, H - 96, 10);
  drawTurnCoordinator(ctx, m + 146, H - 58, plane.bank);
  label(ctx, 'TURN', m + 126, H - 24, 10);

  // --- Bottom-right: fuel + damage gauges + throttle bar (clickable). ---
  panel(ctx, W - 264, H - 128, 250, 114);
  drawGauge(ctx, W - 250, H - 104, 222, 'FUEL', plane.fuel / 100,
    plane.fuel < 20 ? '#ff7d6e' : '#7dff9a');
  drawGauge(ctx, W - 250, H - 74, 222, 'DAMAGE', plane.damage / 100,
    plane.damage > 60 ? '#ff7d6e' : plane.damage > 25 ? '#ffcf3f' : '#7dff9a');
  label(ctx, 'THROTTLE  ' + Math.round(plane.throttle * 100) + '%  (W/S)', W - 250, H - 36, 10);
  // The bar itself is the mouse target input.js looks for (#throttle-bar is a DOM
  // overlay in index.html; this canvas bar mirrors it visually).
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(W - 250, H - 30, 222, 10);
  ctx.fillStyle = AMBER;
  ctx.fillRect(W - 250, H - 30, 222 * clamp(plane.throttle, 0, 1), 10);

  // --- Message line (centre, above the plane). ---
  if (state.message && state.messageUntil > performance.now()) {
    ctx.save();
    ctx.globalAlpha = clamp((state.messageUntil - performance.now()) / 600, 0, 1);
    ctx.fillStyle = '#fff2cf';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.fillText(state.message, W / 2, H * 0.30);
    ctx.restore();
  }

  // --- Wind indicator (rescue mission). ---
  if (mission.def.wind) {
    ctx.fillStyle = '#ffe9b0';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ CROSSWIND ' + mission.def.wind + ' KT FROM THE WEST — HOLD INTO IT', W / 2, m + 116);
  }
}

function drawCompass(ctx, heading, W, y) {
  const cx = W / 2;
  const w = 420;
  ctx.save();
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, y, w, 34, 8);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(cx - w / 2, y, w, 34);
  ctx.clip();
  const pxPerDeg = 4;
  for (let d = -60; d <= 60; d += 5) {
    const hdg = wrapAngle(Math.round(heading) + d);
    const x = cx + d * pxPerDeg;
    const isCard = hdg % 90 === 0;
    const isMid = hdg % 30 === 0;
    ctx.strokeStyle = isCard ? AMBER : 'rgba(255,233,176,0.5)';
    ctx.lineWidth = isCard ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 8);
    ctx.lineTo(x, y + (isCard ? 20 : isMid ? 16 : 12));
    ctx.stroke();
    if (isCard) {
      ctx.fillStyle = '#ffe9b0';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[hdg], x, y + 31);
    }
  }
  // Centre caret.
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx - 6, y + 2);
  ctx.lineTo(cx + 6, y + 2);
  ctx.lineTo(cx, y + 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHorizon(ctx, cx, cy, r, bank, pitch) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank * Math.PI / 180);
  const off = clamp(pitch, -20, 20) * 1.6;
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-r, -r + off, r * 2, r);
  ctx.fillStyle = '#8a5a2e';
  ctx.fillRect(-r, off, r * 2, r);
  ctx.strokeStyle = '#ffe9b0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, off);
  ctx.lineTo(r, off);
  ctx.stroke();
  ctx.rotate(bank * Math.PI / 180);
  // Fixed wings marker.
  ctx.fillStyle = '#ffb347';
  ctx.fillRect(-r + 4, -2, 16, 4);
  ctx.fillRect(r - 20, -2, 16, 4);
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawTurnCoordinator(ctx, cx, cy, bank) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PANEL_EDGE;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.stroke();
  const a = clamp(bank / 38, -1, 1) * 0.9;
  ctx.rotate(a);
  ctx.fillStyle = '#ffe9b0';
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-4, 6);
  ctx.lineTo(4, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGauge(ctx, x, y, w, name, frac, color) {
  ctx.fillStyle = AMBER_DIM;
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(name, x, y - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(x, y, w, 10);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), 10);
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '700 11px ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(frac * 100) + '%', x + w, y - 6);
  ctx.textAlign = 'left';
}

// --- Full-screen states, drawn by main.js over the scene. ---

export function drawTitle(ctx, state, W, H) {
  ctx.fillStyle = 'rgba(10, 12, 24, 0.45)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd98a';
  ctx.font = '700 54px Georgia, serif';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 16;
  ctx.fillText('GARUDA COURIER', W / 2, H * 0.26);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff2cf';
  ctx.font = '600 24px Georgia, serif';
  ctx.fillText('— Nusantara Ring Run —', W / 2, H * 0.26 + 36);
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillText('Bush-plane courier "Cendrawasih-9" over the islands at golden hour.', W / 2, H * 0.26 + 74);
  // Mission cards.
  const cards = state.missionDefs;
  const cw = 300, gap = 24;
  const total = cards.length * cw + (cards.length - 1) * gap;
  let x = (W - total) / 2;
  const y = H * 0.44;
  cards.forEach((m, i) => {
    const sel = state.selectedMission === m.id;
    ctx.fillStyle = sel ? 'rgba(255, 179, 71, 0.28)' : PANEL;
    ctx.strokeStyle = sel ? AMBER : PANEL_EDGE;
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, cw, 132, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe9b0';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText((i + 1) + ' · ' + m.name, x + cw / 2, y + 34);
    ctx.fillStyle = '#e8dcc0';
    ctx.font = '400 14px system-ui, sans-serif';
    wrapText(ctx, m.blurb, x + cw / 2, y + 62, cw - 28, 20);
    ctx.fillStyle = AMBER_DIM;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText('⏱ ' + Math.floor(m.timeLimitSec / 60) + ' min   ·   PAR ' + m.parScore, x + cw / 2, y + 116);
    x += cw + gap;
  });
  ctx.fillStyle = '#fff2cf';
  ctx.font = '600 17px system-ui, sans-serif';
  ctx.fillText('Press 1 / 2 / 3 to pick a sortie, then ENTER to fly.', W / 2, y + 172);
  ctx.font = '400 15px system-ui, sans-serif';
  ctx.fillStyle = '#e8dcc0';
  ctx.fillText('W/S throttle · A/D bank & turn · I/K trim · R restart · P pause · M mute', W / 2, y + 200);
  ctx.fillText('Fly the rings, land the mail, reach the beacon — and mind the fuel.', W / 2, y + 224);
}

function wrapText(ctx, text, cx, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, yy);
      line = w;
      yy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, cx, yy);
}

export function drawEndScreen(ctx, state, W, H, kind) {
  const ok = kind === 'complete';
  ctx.fillStyle = ok ? 'rgba(8, 40, 20, 0.62)' : 'rgba(40, 8, 8, 0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = ok ? '#7dff9a' : '#ff8a7a';
  ctx.font = '700 48px Georgia, serif';
  ctx.fillText(ok ? 'MISSION COMPLETE' : 'SORTIE FAILED', W / 2, H * 0.36);
  ctx.fillStyle = '#fff2cf';
  ctx.font = '400 19px system-ui, sans-serif';
  ctx.fillText(state.endReason, W / 2, H * 0.36 + 40);
  ctx.font = '700 26px ui-monospace, monospace';
  ctx.fillStyle = '#ffe9b0';
  ctx.fillText('SCORE  ' + state.score + '    ·    TIME  ' + fmtTime(state.mission.elapsedSec), W / 2, H * 0.36 + 92);
  ctx.font = '400 16px system-ui, sans-serif';
  ctx.fillStyle = '#e8dcc0';
  ctx.fillText('R — fly again    ·    1/2/3 — another sortie    ·    T — back to title', W / 2, H * 0.36 + 140);
}

export function drawPaused(ctx, W, H) {
  ctx.fillStyle = 'rgba(10, 12, 24, 0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9b0';
  ctx.font = '700 40px Georgia, serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 8);
  ctx.font = '400 17px system-ui, sans-serif';
  ctx.fillStyle = '#e8dcc0';
  ctx.fillText('P to resume · R to restart', W / 2, H / 2 + 28);
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}
