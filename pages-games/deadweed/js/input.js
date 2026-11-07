// input.js — клавиатура, мышь и геймпад (twin-stick)
'use strict';
const FIXED_ACTION_CODES={menuUp:'ArrowUp',menuDown:'ArrowDown',confirm:'Enter',back:'Escape'};
const GAMEPAD_BUTTON_ACTIONS=[[8,['fuse']],[0,['confirm','dash']],[1,['back','melee']],[2,['collectLeft']],[3,['collectRight']],[9,['pause']],[10,['sprint']],[11,['flipLeft']],[12,['menuUp','inspect']],[13,['menuDown','dig']],[14,['dropLeft']],[15,['dropRight']]];
const BROWSER_RESERVED_CODES=new Set(['F1','F3','F4','F5','F6','F11','F12','BrowserBack','BrowserForward']);
const EMPTY_GAMEPADS=[];
function gamepadDeadzone(v) {const a=Math.abs(v);return a<.24?0:(v-Math.sign(v)*.24)/.76;}

class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // нажато в этом кадре
    this.bindings = {
      moveUp: 'KeyW', moveDown: 'KeyS', moveLeft: 'KeyA', moveRight: 'KeyD',
      fireLeft: 'KeyQ', fireRight: 'KeyE', flipLeft: 'KeyF',
      dropLeft: 'Digit1', dropRight: 'Digit2', dash: 'Space', pause: 'KeyP',
      restart: 'KeyR', upgrade1: 'Digit1', upgrade2: 'Digit2', upgrade3: 'Digit3',
      dig:'KeyH', fuse:'KeyG', inspect:'Tab', exportReport:'KeyT', collectLeft:'KeyZ', collectRight:'KeyX', melee:'KeyV', sprint:'ShiftLeft', newRun:'KeyN',
    };
    this.defaults = {...this.bindings};
    this.bindingActions = Object.keys(this.bindings);
    this.padActions = new Set(); this.padEdges = new Set(); this.lastPadActions = new Set();
    this.pauseRequested=false; this.bindingMessage='';
    this.bindingLabels = {
      moveUp: 'Движение вверх', moveDown: 'Движение вниз', moveLeft: 'Движение влево', moveRight: 'Движение вправо',
      fireLeft: 'Стрельба левой рукой', fireRight: 'Стрельба правой рукой', flipLeft: 'Разворот левой руки',
      dropLeft: 'Выбросить оружие слева', dropRight: 'Выбросить оружие справа', dash: 'Рывок', pause: 'Пауза',
      restart: 'Начать заново', upgrade1: 'Улучшение 1', upgrade2: 'Улучшение 2', upgrade3: 'Улучшение 3',
      dig:'Откопать запасной орган (удерживать)', fuse:'Срастить два оружия (удерживать)', inspect:'Характеристики органов (удерживать)', exportReport:'Сохранить отчёт', collectLeft:'Забрать в левую', collectRight:'Забрать в правую', melee:'Удар без патронов', sprint:'Бег (выносливость)', newRun:'Новый случайный забег',
    };
    this.selectedBinding = 0;
    this.waitingForBinding = false;
    this.controlsOpen = false;
    this._loadBindings();
    this.mouse = { x: 0, y: 0, down: false, right: false, inside: false, moved: false };
    this.mouseJust = { down: false, right: false };
    this.pad = {
      active: false,
      moveX: 0, moveY: 0,
      aimX: 0, aimY: 0,
      fireL: false, fireR: false,
      any: false,
    };
    this._bind();
  }

  _bind() {
    const canvas = this.canvas;

    window.addEventListener('keydown', (e) => {
      const target=e.target;
      if(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName || ''))) return;
      if(e.ctrlKey||e.metaKey||e.altKey){e.preventDefault();return;}
      this.usingPad=false;
      const browserFunctionKey=/^F\d+$/.test(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)||BROWSER_RESERVED_CODES.has(e.code)||browserFunctionKey) e.preventDefault();
      if (this.waitingForBinding) {
        e.preventDefault();
        this.waitingForBinding = false;
        if (e.code === 'Escape') {
          this.pressed.add('Escape');
          return;
        }
        const action=this.bindingActions[this.selectedBinding];
        const group=a=>a.startsWith('upgrade') ? 'upgrade' : ['restart','newRun','exportReport'].includes(a) ? 'result' : 'combat';
        const conflict=this.bindingActions.find(a=>a!==action && group(a)===group(action) && this.bindings[a]===e.code);
        if (conflict || BROWSER_RESERVED_CODES.has(e.code) || browserFunctionKey || ['Escape','Enter','ArrowUp','ArrowDown','KeyC','Backspace','End'].includes(e.code)) this.bindingMessage='Занято: '+(conflict ? this.bindingLabels[conflict] : 'интерфейс браузера');
        else {this.bindings[action]=e.code;this.bindingMessage='Сохранено';this._saveBindings();}
        return;
      }
      if(BROWSER_RESERVED_CODES.has(e.code)||browserFunctionKey)return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.pauseRequested=true;
      this.keys.clear();
      this.endFrame();
      this.mouse.down = false;
      this.mouse.right = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      this.usingPad=false;
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.inside = true;
      this.mouse.moved = true;
    });

    canvas.addEventListener('mousedown', (e) => {
      this.usingPad=false;
      e.preventDefault();
      const r=canvas.getBoundingClientRect();this.mouse.x=e.clientX-r.left;this.mouse.y=e.clientY-r.top;this.mouse.inside=true;
      if (e.button === 0) { this.mouse.down = true; this.mouseJust.down = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouseJust.right = true; }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  _loadBindings() {
    try {
      const saved = JSON.parse(localStorage.getItem('deadweed-controls') || '{}');
      for (const action of this.bindingActions) {
        if (typeof saved[action] === 'string') this.bindings[action] = saved[action];
      }
      // Existing user bindings take precedence over the newly introduced action.
      if(!saved.inspect && this.bindingActions.some(a=>a!=='inspect'&&this.bindings[a]===this.bindings.inspect))
        this.bindings.inspect=['Tab',...['I','B','U',...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(k=>'Key'+k),...Array.from({length:24},(_,i)=>'F'+(i+1))].find(code=>!['KeyC','KeyM','KeyO','F5','F11','F12'].includes(code)&&!Object.entries(this.bindings).some(([a,v])=>a!=='inspect'&&v===code));
    } catch (_) {}
  }

  _saveBindings() {
    try { localStorage.setItem('deadweed-controls', JSON.stringify(this.bindings)); } catch (_) {}
  }

  actionDown(action) { return this.down(this.bindings[action]) || this.padActions.has(action); }
  actionHit(action) {
    return this.hit(this.bindings[action] || FIXED_ACTION_CODES[action]) || this.padEdges.has(action);
  }
  resetBindings() {this.bindings={...this.defaults};this.bindingMessage='Клавиши сброшены';this._saveBindings();}
  prompt(action) {
    const labels={inspect:'↑',dig:'↓',fuse:'VIEW',dash:'A',melee:'B',collectLeft:'X',collectRight:'Y',pause:'START',fireLeft:'LB/LT',fireRight:'RB/RT',dropLeft:'←',dropRight:'→',flipLeft:'R3',sprint:'L3',confirm:'A',back:'B',menuUp:'↑',menuDown:'↓',newRun:'A'};
    if(this.usingPad&&this.padStyle==='playstation') {
      const ps={fuse:'SHARE',dash:'✕',melee:'○',collectLeft:'□',collectRight:'△',pause:'OPTIONS',fireLeft:'L1/L2',fireRight:'R1/R2',confirm:'✕',back:'○',newRun:'✕'};
      return ps[action]||labels[action]||this.bindingKeyName(action);
    }
    return this.usingPad && labels[action] ? labels[action] : this.bindingKeyName(action);
  }
  bindingCode(action) { return this.bindings[action]; }
  bindingKeyName(action) {
    const code = this.bindingCode(action) || '';
    return code.startsWith('Key') ? code.slice(3) : code.startsWith('Digit') ? code.slice(5) : code === 'Space' ? 'ПРОБЕЛ' : code;
  }

  selectBinding(delta) {
    this.selectedBinding = (this.selectedBinding + delta + this.bindingActions.length) % this.bindingActions.length;
  }

  beginBinding() { this.waitingForBinding = true; }

  // Preserve arrow movement defaults unless that arrow was explicitly bound
  // to another action in this saved control scheme.
  arrowMove(code, action) {
    if (!this.down(code)) return false;
    for(let i=0;i<this.bindingActions.length;i++) {
      const a=this.bindingActions[i];
      if(a!==action&&this.bindings[a]===code)return false;
    }
    return true;
  }

  // направление движения с клавиатуры; gameplay passes a reusable vector.
  moveVector(out={x:0,y:0}) {
    let x = 0, y = 0;
    if (this.actionDown('moveLeft') || this.arrowMove('ArrowLeft','moveLeft')) x -= 1;
    if (this.actionDown('moveRight') || this.arrowMove('ArrowRight','moveRight')) x += 1;
    if (this.actionDown('moveUp') || this.arrowMove('ArrowUp','moveUp')) y -= 1;
    if (this.actionDown('moveDown') || this.arrowMove('ArrowDown','moveDown')) y += 1;
    const length=Math.hypot(x,y);
    if(length<.00001){out.x=0;out.y=0;}else{out.x=x/length;out.y=y/length;}
    return out;
  }

  update() {
    const pad = this.pad;
    pad.active = false;
    pad.moveX = pad.moveY = pad.aimX = pad.aimY = 0;
    pad.fireL = pad.fireR = pad.any = false;

    const pads = navigator.getGamepads ? navigator.getGamepads() : EMPTY_GAMEPADS;
    let gp = null;
    for (const p of pads) { if (p && p.connected) { gp = p; break; } }
    this.padActions.clear();
    if (!gp) {this.lastPadActions.clear();this.usingPad=false;return;}

    const mx = gamepadDeadzone(gp.axes[0] || 0);
    const my = gamepadDeadzone(gp.axes[1] || 0);
    const ax = gamepadDeadzone(gp.axes[2] || 0);
    const ay = gamepadDeadzone(gp.axes[3] || 0);
    const b = gp.buttons;
    this.padStyle=/playstation|dualshock|dualsense|sony|054c/i.test(gp.id||'')?'playstation':'xbox';
    for(let i=0;i<GAMEPAD_BUTTON_ACTIONS.length;i++){const entry=GAMEPAD_BUTTON_ACTIONS[i],button=b[entry[0]];if(button?.pressed)for(let j=0;j<entry[1].length;j++)this.padActions.add(entry[1][j]);}
    const fireL = !!(b[4] && b[4].pressed) || !!(b[6] && b[6].value > 0.35);
    const fireR = !!(b[5] && b[5].pressed) || !!(b[7] && b[7].value > 0.35);
    if(fireL)this.padActions.add('fireLeft');
    if(fireR)this.padActions.add('fireRight');
    for(const action of this.padActions) if(!this.lastPadActions.has(action)) this.padEdges.add(action);
    this.lastPadActions.clear();
    for(const action of this.padActions)this.lastPadActions.add(action);


    pad.moveX = mx; pad.moveY = my;
    pad.aimX = ax; pad.aimY = ay;
    pad.fireL = fireL; pad.fireR = fireR;
    pad.active = !!(mx || my || ax || ay || fireL || fireR || this.padActions.size);
    pad.any = pad.active;
    if(pad.active)this.usingPad=true;
  }

  endFrame() {
    this.pressed.clear();
    this.padEdges.clear();
    this.mouseJust.down = false;
    this.mouseJust.right = false;
    this.mouse.moved = false;
  }
}
