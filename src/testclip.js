// 5 s pipeline test: moving Marathi title + frame counter + 1 Hz beeps over a soft drone.
(function () {
  const S = window.REEL_STRINGS;
  const T = window.Text;
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : 1 - Math.pow(1 - x, 3);
  window.REEL = {
    duration: 5,
    fps: 30,
    draw(ctx, t) {
      const g = ctx.createLinearGradient(0, 0, 0, 1920);
      g.addColorStop(0, '#7a1414'); g.addColorStop(1, '#2b0c06');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
      // moving disc so motion / seeking is visible in decoded frames
      ctx.fillStyle = '#f6c56b';
      ctx.beginPath(); ctx.arc(140 + (t / 5) * 800, 1500, 70, 0, Math.PI * 2); ctx.fill();
      const k = ease(t / 1.2);
      T.draw(ctx, S.brandFull, 540, 560 + (1 - k) * 300, 150, { fill: '#fff', stroke: '#2b0c06', strokeWidth: 10, align: 'center' });
      ctx.globalAlpha = ease((t - 1) / 1);
      T.draw(ctx, S.tagline, 540, 860, 90, { fill: '#f6c56b', align: 'center' });
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '700 48px "Noto Sans"'; ctx.textAlign = 'center';
      ctx.fillText(`TEST  t=${t.toFixed(2)}s  frame ${Math.round(t * 30)}`, 540, 1760);
    },
    async buildAudio(sr) {
      const dur = 5;
      const ac = new OfflineAudioContext(2, sr * dur, sr);
      const drone = ac.createOscillator(); drone.type = 'sawtooth'; drone.frequency.value = 110;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const dg = ac.createGain(); dg.gain.value = 0.08;
      drone.connect(lp).connect(dg).connect(ac.destination); drone.start(0); drone.stop(dur);
      for (let i = 0; i < dur; i++) {
        const o = ac.createOscillator(); o.frequency.value = i === 0 ? 1320 : 880;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, i); g.gain.linearRampToValueAtTime(0.4, i + 0.01); g.gain.exponentialRampToValueAtTime(0.001, i + 0.25);
        o.connect(g).connect(ac.destination); o.start(i); o.stop(i + 0.3);
      }
      return ac.startRendering();
    },
  };
})();
