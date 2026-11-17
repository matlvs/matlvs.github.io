/* Living network background + scroll reveal.
   Any <canvas class="net"> on a page gets an animated flow network. */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- Scroll reveal ---------------- */
  var targets = document.querySelectorAll(
    'main h2, .card, .topic, .pubs li, .cv-entry, .news li, .subhead'
  );
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.05 });

    targets.forEach(function (el) {
      // Only animate what starts below the fold: no flash for visible content.
      if (el.getBoundingClientRect().top > window.innerHeight) {
        el.classList.add('reveal');
        io.observe(el);
      }
    });
  }

  /* ---------------- Network ---------------- */
  function rand(a, b) { return a + Math.random() * (b - a); }

  function accentRGB() {
    var probe = document.createElement('span');
    probe.style.color = 'var(--accent)';
    document.body.appendChild(probe);
    var c = getComputedStyle(probe).color;
    probe.remove();
    var m = c.match(/\d+(\.\d+)?/g) || [31, 111, 120];
    return m.slice(0, 3).map(Number);
  }

  function Network(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mouse = { x: -1e4, y: -1e4 };
    this.visible = true;
    this.t0 = performance.now();
    this.build();

    var self = this;
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { self.build(); }, 200);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      self.rgb = accentRGB();
      if (reduceMotion) self.draw(1e6);
    });
    var host = canvas.parentElement;
    host.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      self.mouse.x = e.clientX - r.left;
      self.mouse.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', function () {
      self.mouse.x = self.mouse.y = -1e4;
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        self.visible = en[0].isIntersecting;
      }).observe(canvas);
    }
  }

  Network.prototype.build = function () {
    var c = this.canvas;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth, h = c.clientHeight;
    c.width = w * dpr; c.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
    this.rgb = accentRGB();

    // Jittered grid of nodes, denser on the right where there is less text.
    var step = Math.max(46, Math.min(70, w / 18));
    var nodes = [];
    for (var y = -step / 2; y < h + step; y += step * 0.86) {
      for (var x = -step / 2; x < w + step; x += step) {
        var bias = x / w; // 0 at left, 1 at right
        if (Math.random() > 0.25 + 0.75 * bias) continue;
        nodes.push({ x: x + rand(-0.4, 0.4) * step, y: y + rand(-0.4, 0.4) * step });
      }
    }

    // Connect each node to its 2-3 nearest neighbours.
    var edges = [], seen = {};
    nodes.forEach(function (a, i) {
      var d = nodes.map(function (b, j) {
        return { j: j, d: (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y) };
      }).sort(function (p, q) { return p.d - q.d; });
      var k = Math.random() < 0.5 ? 2 : 3;
      for (var n = 1; n <= k && n < d.length; n++) {
        var j = d[n].j, key = i < j ? i + '-' + j : j + '-' + i;
        if (seen[key]) continue;
        seen[key] = true;
        edges.push({ a: i, b: j });
      }
    });

    // Growth order: breadth-first from a seed on the right edge.
    var adj = nodes.map(function () { return []; });
    edges.forEach(function (e, k) { adj[e.a].push(k); adj[e.b].push(k); });
    var seed = 0;
    nodes.forEach(function (n, i) {
      if (Math.abs(n.y - h / 2) + (w - n.x) < Math.abs(nodes[seed].y - h / 2) + (w - nodes[seed].x)) seed = i;
    });
    var depth = nodes.map(function () { return -1; });
    depth[seed] = 0;
    var queue = [seed], maxDepth = 1;
    while (queue.length) {
      var u = queue.shift();
      adj[u].forEach(function (k) {
        var e = edges[k], v = e.a === u ? e.b : e.a;
        if (depth[v] < 0) { depth[v] = depth[u] + 1; maxDepth = Math.max(maxDepth, depth[v]); queue.push(v); }
      });
    }

    edges.forEach(function (e) {
      var A = nodes[e.a], B = nodes[e.b];
      e.len = Math.hypot(B.x - A.x, B.y - A.y);
      e.base = Math.random() < 0.18 ? rand(2.2, 3.4) : rand(0.6, 1.5); // a few thick veins
      e.start = Math.max(0, Math.min(depth[e.a], depth[e.b])) / maxDepth; // growth delay 0..1
      e.dir = Math.random() < 0.5 ? 1 : -1;
      e.phase = Math.random();
      // slight curvature, like real tubes
      var nx = -(B.y - A.y) / (e.len || 1), ny = (B.x - A.x) / (e.len || 1), bend = rand(-0.18, 0.18) * e.len;
      e.cx = (A.x + B.x) / 2 + nx * bend;
      e.cy = (A.y + B.y) / 2 + ny * bend;
    });

    this.nodes = nodes;
    this.edges = edges;
    this.t0 = performance.now();
    if (reduceMotion) this.draw(1e6);
  };

  Network.prototype.draw = function (now) {
    var ctx = this.ctx, w = this.w, h = this.h, rgb = this.rgb, nodes = this.nodes, m = this.mouse;
    var t = Math.max(0, (now - this.t0) / 1000);
    var grow = reduceMotion ? 1 : Math.min(1, t / 2.6); // growth phase lasts ~2.6 s
    ctx.clearRect(0, 0, w, h);

    var col = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',';

    this.edges.forEach(function (e) {
      var local = (grow - e.start * 0.85) / 0.15; // how far this edge has grown
      if (local <= 0) return;
      local = Math.min(1, local);
      var A = nodes[e.a], B = nodes[e.b];

      // Peristaltic wave travelling across the network (as in Physarum).
      var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      var wave = reduceMotion ? 0 : Math.sin(mx * 0.012 + my * 0.006 - t * 1.4);
      var dm = Math.hypot(mx - m.x, my - m.y);
      var near = Math.max(0, 1 - dm / 160);

      var width = e.base * (1 + 0.28 * wave) * (1 + 0.6 * near);
      var alpha = (0.16 + 0.06 * wave + 0.35 * near) * (e.base > 2 ? 1.25 : 1);

      ctx.strokeStyle = col + alpha.toFixed(3) + ')';
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (local >= 1) {
        ctx.moveTo(A.x, A.y);
        ctx.quadraticCurveTo(e.cx, e.cy, B.x, B.y);
      } else {
        // partially grown edge: draw along the curve up to `local`
        ctx.moveTo(A.x, A.y);
        for (var s = 1; s <= 10; s++) {
          var u = (s / 10) * local, iu = 1 - u;
          ctx.lineTo(iu * iu * A.x + 2 * iu * u * e.cx + u * u * B.x,
                     iu * iu * A.y + 2 * iu * u * e.cy + u * u * B.y);
        }
      }
      ctx.stroke();

      // Small particle carried by the flow along thick veins.
      if (!reduceMotion && local >= 1 && e.base > 1.2) {
        var p = (e.phase + e.dir * t * 60 / e.len) % 1;
        if (p < 0) p += 1;
        var ip = 1 - p;
        var px = ip * ip * A.x + 2 * ip * p * e.cx + p * p * B.x;
        var py = ip * ip * A.y + 2 * ip * p * e.cy + p * p * B.y;
        ctx.fillStyle = col + (0.35 + 0.4 * near).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(px, py, 1.4 + 0.4 * e.base, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Junctions
    nodes.forEach(function (n) {
      var d = Math.hypot(n.x - m.x, n.y - m.y);
      var near = Math.max(0, 1 - d / 160);
      ctx.fillStyle = col + (0.22 + 0.5 * near).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(n.x, n.y, (1.6 + 1.6 * near) * grow, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  /* ---------------- Theme toggle ---------------- */
  var root = document.documentElement;
  var sysDark = window.matchMedia('(prefers-color-scheme: dark)');
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : sysDark.matches;
  }
  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      nets.forEach(function (n) { n.rgb = accentRGB(); if (reduceMotion) (n.drawFrame ? n.drawFrame(0) : n.draw(1e6)); });
    });
  });

  /* ---------------- Droplet coarsening ----------------
     Micro-lumens exchange fluid through hydraulic links, driven by
     Laplace pressure (P ~ 1/R): small droplets empty into large ones,
     touching droplets fuse. Beads show the direction of flow.
     When one lumen is left, the scene fades and re-nucleates. */
  function Droplets(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.mouse = { x: -1e4, y: -1e4 };
    this.visible = true;
    this.last = null;
    var self = this, resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () { self.build(); }, 200);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      self.rgb = accentRGB();
      if (reduceMotion) self.drawFrame(0);
    });
    var host = canvas.parentElement;
    host.addEventListener('pointermove', function (e) {
      var r = canvas.getBoundingClientRect();
      self.mouse.x = e.clientX - r.left; self.mouse.y = e.clientY - r.top;
    });
    host.addEventListener('pointerleave', function () { self.mouse.x = self.mouse.y = -1e4; });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; }).observe(canvas);
    }
    this.build();
  }

  Droplets.prototype.build = function () {
    var c = this.canvas, dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = c.clientWidth; this.h = c.clientHeight;
    c.width = this.w * dpr; c.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.rgb = accentRGB();
    this.seed();
    if (reduceMotion) {
      for (var i = 0; i < 500; i++) this.step(1 / 60); // show a mid-coarsening state
      this.phase = 'run'; this.fade = 1;
      this.drawFrame(0);
    }
  };

  Droplets.prototype.seed = function () {
    var w = this.w, h = this.h, drops = [];
    var target = Math.round(Math.min(90, Math.max(25, w * h / 5200)));
    var tries = 0;
    while (drops.length < target && tries++ < target * 40) {
      var x = rand(0, 1);
      if (Math.random() > 0.2 + 0.8 * x) continue;        // denser on the right
      var d = { x: x * w, y: rand(0.05, 0.95) * h, r: 0, r0: rand(4.5, 11), wob: rand(0, 6.28) };
      var ok = drops.every(function (o) { return Math.hypot(o.x - d.x, o.y - d.y) > o.r0 + d.r0 + 8; });
      if (ok) { d.A = Math.PI * d.r0 * d.r0; drops.push(d); }
    }
    this.drops = drops;
    this.links = {};
    this.phase = 'grow';   // grow -> run -> fade -> (reseed)
    this.timer = 0;
    this.fade = 1;
  };

  Droplets.prototype.step = function (dt) {
    var drops = this.drops, links = {}, K = 9000, reach = 90;
    this.timer += dt;

    if (this.phase === 'grow') {
      var g = Math.min(1, this.timer / 1.6);
      var e = 1 - Math.pow(1 - g, 3);
      drops.forEach(function (d) { d.r = d.r0 * e; });
      if (g >= 1) { this.phase = 'run'; this.timer = 0; }
      this.links = links;
      return;
    }
    if (this.phase === 'fade') {
      this.fade = Math.max(0, this.fade - dt / 1.8);
      if (this.fade <= 0) this.seed();
      return;
    }

    // Hydraulic exchange between neighbours: dA_i = K (P_j - P_i) / L_ij
    // Each droplet is linked to its two nearest neighbours, plus any within reach.
    var dA = drops.map(function () { return 0; });
    var n = drops.length, pairs = {}, timer = this.timer;
    for (var i = 0; i < n; i++) {
      var near = [];
      for (var j = 0; j < n; j++) {
        if (j === i) continue;
        var gp = Math.hypot(drops[i].x - drops[j].x, drops[i].y - drops[j].y) - drops[i].r - drops[j].r;
        near.push({ j: j, g: gp });
        if (gp < reach) pairs[Math.min(i, j) + '-' + Math.max(i, j)] = 1;
      }
      near.sort(function (p, q) { return p.g - q.g; });
      for (var k2 = 0; k2 < Math.min(2, near.length); k2++) {
        var jj = near[k2].j;
        pairs[Math.min(i, jj) + '-' + Math.max(i, jj)] = 1;
      }
    }
    Object.keys(pairs).forEach(function (key) {
      var ij = key.split('-'), i1 = +ij[0], j1 = +ij[1], a = drops[i1], b = drops[j1];
      var gap = Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r;
      var L = Math.max(gap, 6) + 20;
      var q = K * (1 + timer / 4) * (1 / b.r - 1 / a.r) / L;  // >0 : flow b -> a
      dA[i1] += q * dt; dA[j1] -= q * dt;
      links[key] = { a: a, b: b, q: q, id: i1 * 7 + j1 };
    });
    var m = this.mouse;
    drops.forEach(function (d, i) {
      d.A = Math.max(0, d.A + dA[i]);
      // the cursor acts as a gentle pump on nearby lumens
      var near = Math.max(0, 1 - Math.hypot(d.x - m.x, d.y - m.y) / 120);
      d.pump = near;
      d.r = Math.sqrt(d.A / Math.PI);
      d.x += rand(-0.15, 0.15) * (8 / (d.r + 4));         // small thermal jiggle
      d.y += rand(-0.15, 0.15) * (8 / (d.r + 4));
    });

    // Vanishing droplets give their remaining fluid to the closest one
    for (i = drops.length - 1; i >= 0; i--) {
      if (drops[i].r < 1.6 && drops.length > 1) {
        var dead = drops[i], best = -1, bd = 1e9;
        drops.forEach(function (o, k) {
          if (k === i) return;
          var dd = Math.hypot(o.x - dead.x, o.y - dead.y) - o.r;
          if (dd < bd) { bd = dd; best = k; }
        });
        drops[best].A += dead.A;
        dead.gone = true;
        drops.splice(i, 1);
      }
    }
    // Fusion of touching droplets (area-weighted centre)
    var merged = true;
    while (merged) {
      merged = false;
      for (i = 0; i < drops.length && !merged; i++) {
        for (j = i + 1; j < drops.length && !merged; j++) {
          var p = drops[i], s = drops[j];
          if (Math.hypot(p.x - s.x, p.y - s.y) < (p.r + s.r) * 0.92) {
            var A = p.A + s.A;
            p.x = (p.x * p.A + s.x * s.A) / A;
            p.y = (p.y * p.A + s.y * s.A) / A;
            p.A = A; p.r = Math.sqrt(A / Math.PI);
            p.flash = 1;
            s.gone = true;
            drops.splice(j, 1);
            merged = true;
          }
        }
      }
    }
    this.links = links;

    if ((drops.length <= 2 && this.timer > 4) || this.timer > 34) {
      this.phase = 'fade'; this.timer = 0;
    }
  };

  Droplets.prototype.draw = function (now) {
    var dt = this.last === null ? 1 / 60 : Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.drawFrame(now / 1000);
  };

  Droplets.prototype.drawFrame = function (t) {
    var ctx = this.ctx, drops = this.drops, rgb = this.rgb, f = this.fade;
    var col = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',';
    ctx.clearRect(0, 0, this.w, this.h);

    // Hydraulic links and flowing beads
    var keys = Object.keys(this.links);
    keys.forEach(function (k) {
      var L = this.links[k], a = L.a, b = L.b;
      if (a.gone || b.gone) return;
      var mag = Math.min(1, Math.abs(L.q) / 6);
      if (mag < 0.04) return;
      ctx.strokeStyle = col + (0.10 * mag * f + 0.03 * f).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (reduceMotion) return;
      // from shrinking to growing droplet
      var from = L.q > 0 ? b : a, to = L.q > 0 ? a : b;
      var len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
      for (var n = 0; n < 2; n++) {
        var u = ((t * (25 + 70 * mag)) / len + n * 0.5 + (L.id * 0.137)) % 1;
        var x = from.x + (to.x - from.x) * u, y = from.y + (to.y - from.y) * u;
        // hide the bead while it is inside a droplet
        if (Math.hypot(x - from.x, y - from.y) < from.r || Math.hypot(x - to.x, y - to.y) < to.r) continue;
        ctx.fillStyle = col + ((0.25 + 0.5 * mag) * f).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(x, y, 1.3 + mag, 0, Math.PI * 2); ctx.fill();
      }
    }, this);

    // Droplets with a softly wobbling membrane
    drops.forEach(function (d) {
      if (d.r < 0.5) return;
      var pump = d.pump || 0, flash = d.flash || 0;
      var R = d.r * (1 + 0.06 * pump);
      ctx.beginPath();
      var seg = 28;
      for (var s = 0; s <= seg; s++) {
        var th = (s / seg) * Math.PI * 2;
        var rr = R * (1 + 0.035 * Math.sin(3 * th + d.wob + t * 1.3) + 0.025 * Math.sin(5 * th - d.wob - t * 0.9));
        var x = d.x + rr * Math.cos(th), y = d.y + rr * Math.sin(th);
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      var grad = ctx.createRadialGradient(d.x - R * 0.3, d.y - R * 0.35, R * 0.1, d.x, d.y, R);
      grad.addColorStop(0, col + ((0.05 + 0.10 * pump + 0.15 * flash) * f).toFixed(3) + ')');
      grad.addColorStop(1, col + ((0.16 + 0.12 * pump + 0.2 * flash) * f).toFixed(3) + ')');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = col + ((0.45 + 0.3 * pump + 0.3 * flash) * f).toFixed(3) + ')';
      ctx.lineWidth = 1.1 + 0.5 * flash;
      ctx.stroke();
      if (d.flash) d.flash = Math.max(0, d.flash - 0.03);
    });
  };

  var nets = [];
  document.querySelectorAll('canvas.net').forEach(function (c) {
    nets.push(c.dataset.anim === 'drops' ? new Droplets(c) : new Network(c));
  });

  if (!reduceMotion && nets.length) {
    (function loop(now) {
      if (!document.hidden) nets.forEach(function (n) { if (n.visible) n.draw(now); });
      requestAnimationFrame(loop);
    })(performance.now());
  }
})();
