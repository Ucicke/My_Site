/* ================================================================
   SCROLL HUNTER · engine/audio.js — синтез звука на Web Audio
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   3. Звук: синтез на Web Audio, без единого файла
--------------------------------------------------------------- */
const Sfx = {
    ctx: null,
    master: null,
    muted: false,

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try {
            this.ctx = new AC();
            this.master = this.ctx.createGain();
            this.master.gain.value = this.muted ? 0 : 0.55;
            this.master.connect(this.ctx.destination);
        } catch (e) {
            this.ctx = null;
        }
    },

    setMuted(muted) {
        this.muted = muted;
        if (this.master) {
            this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
        }
    },

    /* Тональный сигнал с огибающей */
    tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.2, delay = 0, exp = true }) {
        if (!this.ctx || this.muted) return;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, f0), t0);
        if (f1 !== null) {
            if (exp) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
            else osc.frequency.linearRampToValueAtTime(Math.max(20, f1), t0 + dur);
        }
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur * 0.3));
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
    },

    /* Шумовой всплеск с фильтром */
    noise({ dur = 0.25, vol = 0.18, delay = 0, freq = 1200, q = 1, sweep = null }) {
        if (!this.ctx || this.muted) return;
        const t0 = this.ctx.currentTime + delay;
        const len = Math.max(1, Math.ceil(this.ctx.sampleRate * dur));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (GameRng.next('audio') * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq, t0);
        filter.Q.value = q;
        if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t0 + dur);
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        src.start(t0);
        src.stop(t0 + dur);
    },

    play(name) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        switch (name) {
            case 'click':
                this.tone({ type: 'square', f0: 620, f1: 880, dur: 0.07, vol: 0.09 });
                break;
            case 'select':
                this.tone({ type: 'triangle', f0: 380, f1: 540, dur: 0.09, vol: 0.10 });
                break;
            case 'check':
                this.noise({ dur: 0.30, vol: 0.11, freq: 1100, sweep: 240, q: 2 });
                this.tone({ type: 'sine', f0: 320, f1: 560, dur: 0.26, vol: 0.07 });
                break;
            case 'open':
                this.noise({ dur: 0.40, vol: 0.15, freq: 700, sweep: 170, q: 1.1 });
                this.tone({ type: 'sawtooth', f0: 130, f1: 72, dur: 0.32, vol: 0.07 });
                break;
            case 'scroll':
                [0, 0.09, 0.19].forEach((d, i) => {
                    this.tone({ type: 'sine', f0: 523 * (1 + i * 0.5), f1: 1046 * (1 + i * 0.25), dur: 0.5, vol: 0.085, delay: d });
                });
                this.noise({ dur: 0.5, vol: 0.05, freq: 4200, q: 0.7 });
                break;
            case 'mimic':
                this.tone({ type: 'sawtooth', f0: 190, f1: 70, dur: 0.55, vol: 0.15 });
                this.noise({ dur: 0.45, vol: 0.13, freq: 320, sweep: 90, q: 0.8 });
                break;
            case 'bite':
                this.tone({ type: 'square', f0: 430, f1: 90, dur: 0.32, vol: 0.15 });
                this.noise({ dur: 0.28, vol: 0.16, freq: 2600, sweep: 320, q: 0.6 });
                break;
            case 'hurt':
                this.tone({ type: 'triangle', f0: 230, f1: 68, dur: 0.45, vol: 0.13 });
                break;
            case 'shield':
                this.tone({ type: 'sine', f0: 660, f1: 1320, dur: 0.28, vol: 0.11 });
                this.tone({ type: 'sine', f0: 990, f1: 1980, dur: 0.34, vol: 0.06, delay: 0.04 });
                break;
            case 'curse':
                this.tone({ type: 'sawtooth', f0: 240, f1: 90, dur: 0.6, vol: 0.12 });
                this.noise({ dur: 0.5, vol: 0.08, freq: 220, sweep: 80, q: 1.4 });
                break;
            case 'empty':
                this.tone({ type: 'triangle', f0: 300, f1: 150, dur: 0.35, vol: 0.08 });
                this.noise({ dur: 0.3, vol: 0.07, freq: 900, sweep: 300, q: 0.9 });
                break;
            case 'heart':
                this.tone({ type: 'sine', f0: 880, f1: 1320, dur: 0.22, vol: 0.10 });
                break;
            case 'room':
                this.tone({ type: 'triangle', f0: 180, f1: 240, dur: 0.18, vol: 0.07 });
                break;
            case 'win':
                [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
                    this.tone({ type: 'triangle', f0: f, dur: 0.5, vol: 0.11, delay: i * 0.12 });
                    this.tone({ type: 'sine', f0: f * 2, dur: 0.4, vol: 0.04, delay: i * 0.12 });
                });
                break;
            case 'lose':
                [392, 329.6, 261.6, 196].forEach((f, i) => {
                    this.tone({ type: 'sawtooth', f0: f, dur: 0.55, vol: 0.09, delay: i * 0.17 });
                });
                break;
        }
    }
};

