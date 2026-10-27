(() => {
  const canvas = document.getElementById("cellCanvas");
  const ctx = canvas.getContext("2d");
  const saltSlider = document.getElementById("saltSlider");
  const saltValue = document.getElementById("saltValue");
  const volumeStat = document.getElementById("volumeStat");
  const saltStat = document.getElementById("saltStat");
  const flowStat = document.getElementById("flowStat");
  const stateStat = document.getElementById("stateStat");
  const stateHint = document.getElementById("stateHint");
  const volumeBar = document.getElementById("volumeBar");
  const saltBar = document.getElementById("saltBar");
  const flowBar = document.getElementById("flowBar");
  const miniCell = document.getElementById("miniCell");
  const miniArrows = document.getElementById("miniArrows");
  const resetBtn = document.getElementById("resetBtn");

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let cssW = 640;
  let cssH = 420;

  function resizeCanvas() {
    const wrap = canvas.parentElement;
    cssW = wrap.clientWidth;
    cssH = Math.max(300, Math.min(420, Math.round(cssW * 0.62)));
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Physics state
  let targetSalt = 20; // 0–100 slider
  let salt = 20;
  let cellRadius = 1; // 0.55–1.0 relative
  let targetRadius = 1;
  let particles = [];
  let waterDrops = [];
  let time = 0;

  function createParticles() {
    particles = [];
    const count = 48;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random(),
        y: Math.random(),
        r: 2 + Math.random() * 3.5,
        phase: Math.random() * Math.PI * 2,
        speed: 0.15 + Math.random() * 0.35,
        salt: Math.random() > 0.35,
      });
    }
  }

  function saltToRadius(s) {
    // Balanced around ~18–25; higher salt → smaller cell
    const t = Math.max(0, Math.min(1, (s - 5) / 90));
    // Hypertonic shrinks; hypotonic swells
    if (s < 15) {
      const swell = (15 - s) / 15;
      return 1 + swell * 0.22;
    }
    return 1 - t * 0.42;
  }

  function saltPercentLabel(s) {
    // Map 0–100 → ~0.2% – 3.5% NaCl-ish for demo
    return (0.2 + (s / 100) * 3.3).toFixed(1) + "%";
  }

  function stateFromSalt(s) {
    if (s < 12) {
      return {
        name: "Hypotonic — water enters",
        hint: "Outside is dilute. Water rushes into the cell; it swells.",
        pill: "dilute",
        pillClass: "",
        color: "#2a7a6e",
      };
    }
    if (s < 32) {
      return {
        name: "Isotonic — balanced",
        hint: "Water moves in and out at roughly the same rate.",
        pill: "normal",
        pillClass: "",
        color: "#2a7a6e",
      };
    }
    if (s < 65) {
      return {
        name: "Mildly hypertonic",
        hint: "Saltier outside. Water is leaving the cell — you’re edging toward dehydration.",
        pill: "salty",
        pillClass: "warn",
        color: "#c45c26",
      };
    }
    return {
      name: "Hypertonic — dehydrating",
      hint: "High salt outside pulls water out hard. Cells shrink; thirst kicks in.",
      pill: "very salty",
      pillClass: "danger",
      color: "#b33a3a",
    };
  }

  function spawnWaterDrop(cx, cy, r, outward) {
    if (waterDrops.length > 40) return;
    const angle = Math.random() * Math.PI * 2;
    const edge = r * (0.92 + Math.random() * 0.08);
    waterDrops.push({
      x: cx + Math.cos(angle) * edge,
      y: cy + Math.sin(angle) * edge,
      vx: Math.cos(angle) * (outward ? 1 : -1) * (0.6 + Math.random() * 1.2),
      vy: Math.sin(angle) * (outward ? 1 : -1) * (0.6 + Math.random() * 1.2),
      life: 1,
      outward,
    });
  }

  function updateUI() {
    const vol = Math.round(cellRadius * 100);
    const st = stateFromSalt(salt);
    const flow = Math.abs(targetRadius - cellRadius) * 8 + Math.abs(salt - 22) * 0.02;
    const flowMag = Math.min(100, flow * 40);

    volumeStat.textContent = vol + "%";
    saltStat.textContent = saltPercentLabel(salt);
    if (salt < 15) {
      flowStat.textContent = "← in";
    } else if (salt > 32) {
      flowStat.textContent = "out →";
    } else {
      flowStat.textContent = "≈ 0";
    }

    stateStat.textContent = st.name;
    stateStat.style.color = st.color;
    stateHint.textContent = st.hint;
    saltValue.textContent = st.pill;
    saltValue.className = "value-pill" + (st.pillClass ? " " + st.pillClass : "");

    volumeBar.style.width = Math.min(100, vol) + "%";
    saltBar.style.width = salt + "%";
    flowBar.style.width = flowMag + "%";

    if (cellRadius < 0.78) {
      miniCell.classList.add("shrunk");
      miniArrows.style.opacity = "1";
      miniArrows.textContent = "→ →";
    } else if (cellRadius > 1.08) {
      miniCell.classList.remove("shrunk");
      miniArrows.style.opacity = "1";
      miniArrows.textContent = "← ←";
    } else {
      miniCell.classList.remove("shrunk");
      miniArrows.style.opacity = "0.5";
      miniArrows.textContent = "↔";
    }

    saltSlider.setAttribute("aria-valuenow", String(Math.round(salt)));
  }

  function draw() {
    const w = cssW;
    const h = cssH;
    time += 0.016;

    // Smooth toward targets
    salt += (targetSalt - salt) * 0.08;
    targetRadius = saltToRadius(salt);
    cellRadius += (targetRadius - cellRadius) * 0.06;

    // Spawn water particles based on gradient
    const delta = targetRadius - cellRadius;
    const saltPush = salt - 22;
    if (Math.abs(saltPush) > 4 && Math.random() < 0.35 + Math.abs(saltPush) * 0.008) {
      const cx = w * 0.5;
      const cy = h * 0.48;
      const baseR = Math.min(w, h) * 0.28;
      const r = baseR * cellRadius;
      spawnWaterDrop(cx, cy, r, saltPush > 0);
    }

    // Background fluid
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#f4efe6");
    g.addColorStop(1, "#e8e0d2");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Soft ambient blobs
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const bx = w * (0.2 + i * 0.3) + Math.sin(time * 0.4 + i) * 12;
      const by = h * (0.3 + (i % 2) * 0.35);
      const grad = ctx.createRadialGradient(bx, by, 0, bx, by, 80);
      grad.addColorStop(0, "rgba(196, 92, 38, 0.04)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(bx, by, 80, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const cx = w * 0.5;
    const cy = h * 0.48;
    const baseR = Math.min(w, h) * 0.28;
    const r = baseR * cellRadius;

    // Outside salt crystals (more when salt high)
    const saltCount = Math.floor(6 + salt * 0.45);
    for (let i = 0; i < saltCount; i++) {
      const p = particles[i % particles.length];
      const px = p.x * w;
      const py = p.y * h;
      // Keep outside cell
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      let sx = px;
      let sy = py;
      if (dist < r + 18) {
        const ang = Math.atan2(dy, dx);
        sx = cx + Math.cos(ang) * (r + 22 + (i % 5) * 6);
        sy = cy + Math.sin(ang) * (r + 22 + (i % 5) * 6);
      }
      const bob = Math.sin(time * p.speed + p.phase) * 3;
      const alpha = 0.25 + (salt / 100) * 0.55;
      ctx.save();
      ctx.translate(sx, sy + bob);
      ctx.rotate(time * 0.1 + p.phase);
      ctx.fillStyle = `rgba(196, 120, 70, ${alpha})`;
      // crystal diamond
      const s = p.r * (0.9 + salt / 200);
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Membrane glow
    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.35);
    glow.addColorStop(0, "rgba(61, 110, 165, 0.12)");
    glow.addColorStop(0.55, "rgba(61, 110, 165, 0.06)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // Cell body
    const cellGrad = ctx.createRadialGradient(
      cx - r * 0.25,
      cy - r * 0.3,
      r * 0.1,
      cx,
      cy,
      r
    );
    const shrinkT = Math.max(0, Math.min(1, (1 - cellRadius) / 0.42));
    // Bluer when full of water, more muted when shrunk
    cellGrad.addColorStop(0, `rgba(${140 - shrinkT * 40}, ${190 - shrinkT * 50}, ${220 - shrinkT * 40}, 0.95)`);
    cellGrad.addColorStop(0.55, `rgba(${70 - shrinkT * 15}, ${130 - shrinkT * 40}, ${180 - shrinkT * 30}, 0.92)`);
    cellGrad.addColorStop(1, `rgba(${40}, ${90 - shrinkT * 20}, ${140 - shrinkT * 20}, 0.95)`);

    ctx.beginPath();
    // Slight wrinkle when hypertonic
    if (cellRadius < 0.85) {
      const spikes = 28;
      for (let i = 0; i <= spikes; i++) {
        const a = (i / spikes) * Math.PI * 2;
        const wobble = 1 + Math.sin(a * 5 + time * 1.5) * 0.035 * (1 - cellRadius);
        const rr = r * wobble;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    } else {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.fillStyle = cellGrad;
    ctx.fill();

    // Membrane ring
    ctx.strokeStyle = `rgba(30, 70, 110, ${0.35 + shrinkT * 0.2})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Nucleus
    const nr = r * 0.28;
    const ng = ctx.createRadialGradient(cx - nr * 0.2, cy - nr * 0.2, 0, cx, cy, nr);
    ng.addColorStop(0, "rgba(90, 50, 120, 0.55)");
    ng.addColorStop(1, "rgba(50, 30, 80, 0.75)");
    ctx.beginPath();
    ctx.arc(cx, cy, nr, 0, Math.PI * 2);
    ctx.fillStyle = ng;
    ctx.fill();

    // Inner water sparkles
    const innerCount = Math.floor(8 + cellRadius * 12);
    for (let i = 0; i < innerCount; i++) {
      const a = time * 0.5 + i * 1.7;
      const pr = r * (0.35 + (i % 5) * 0.1);
      const px = cx + Math.cos(a + i) * pr * 0.7;
      const py = cy + Math.sin(a * 0.9 + i * 0.6) * pr * 0.55;
      ctx.beginPath();
      ctx.arc(px, py, 1.5 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + cellRadius * 0.2})`;
      ctx.fill();
    }

    // H2O label inside — only when there is room under the nucleus
    if (r > 48) {
      const labelY = Math.min(cy + r * 0.42, cy + r - 14);
      if (labelY > cy + nr + 8) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = `600 ${Math.max(11, Math.min(16, r * 0.13))}px "DM Sans", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("H₂O", cx, labelY);
      }
    }

    // Water flow particles
    for (let i = waterDrops.length - 1; i >= 0; i--) {
      const d = waterDrops[i];
      d.x += d.vx;
      d.y += d.vy;
      d.life -= 0.018;
      if (d.life <= 0) {
        waterDrops.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(d.x, d.y, 2.5 * d.life + 1, 0, Math.PI * 2);
      ctx.fillStyle = d.outward
        ? `rgba(61, 140, 180, ${0.55 * d.life})`
        : `rgba(80, 170, 150, ${0.55 * d.life})`;
      ctx.fill();
    }

    // Legend strip — bottom-left, clear of HTML "Outside fluid" (bottom-right)
    ctx.fillStyle = "rgba(28, 25, 21, 0.5)";
    ctx.font = '600 10px "DM Sans", sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("◆ salt  ·  ● water flow", 14, h - 14);

    // Flow callout — top-center, clear of HTML "Inside cell" (top-left)
    const label = salt > 32 ? "Water leaving →" : salt < 15 ? "← Water entering" : "Balanced flow";
    ctx.font = '600 12px "DM Sans", sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const labelW = ctx.measureText(label).width;
    const padX = 10;
    const boxW = labelW + padX * 2;
    const boxH = 22;
    const boxX = cx - boxW / 2;
    const boxY = 10;
    ctx.fillStyle = "rgba(247, 244, 239, 0.88)";
    ctx.beginPath();
    const rr = 11;
    ctx.moveTo(boxX + rr, boxY);
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + boxH, rr);
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX, boxY + boxH, rr);
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY, rr);
    ctx.arcTo(boxX, boxY, boxX + boxW, boxY, rr);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = salt > 32 ? "rgba(196, 92, 38, 0.95)" : salt < 15 ? "rgba(42, 122, 110, 0.95)" : "rgba(92, 86, 76, 0.85)";
    ctx.fillText(label, cx, boxY + boxH / 2);

    updateUI();
    requestAnimationFrame(draw);
  }

  // Events
  saltSlider.addEventListener("input", () => {
    targetSalt = Number(saltSlider.value);
  });

  document.querySelectorAll(".preset[data-salt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = Number(btn.dataset.salt);
      targetSalt = v;
      saltSlider.value = String(v);
    });
  });

  resetBtn.addEventListener("click", () => {
    targetSalt = 20;
    saltSlider.value = "20";
  });

  document.querySelectorAll(".compare-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".compare-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      const mode = card.dataset.mode;
      let v = 20;
      if (mode === "hypo") v = 6;
      if (mode === "iso") v = 20;
      if (mode === "hyper") v = 80;
      targetSalt = v;
      saltSlider.value = String(v);
      canvas.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  resizeCanvas();
  createParticles();
  requestAnimationFrame(draw);
})();
