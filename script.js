import normalizeWheel from "https://cdn.skypack.dev/normalize-wheel@1.0.1";
import {
  EffectComposer,
  RenderPass,
  ShaderPass,
} from "https://cdn.skypack.dev/postprocessing@6.27.0";

const GRID_GAP = 0.5;
const TILE_SIZE = 3;
const TILE_SPACE = TILE_SIZE + GRID_GAP;
const GRID_SIZE = TILE_SPACE * 3;
const TOTAL_GRID_SIZE = GRID_SIZE * 3;
const IMAGE_RES = 512;

// image tiles
const TILES = [
  {
    pos: [-TILE_SPACE, TILE_SPACE, 0],
    image: `/imgs/IMG_6281.PNG`,
  },
  {
    pos: [0, TILE_SPACE, 0],
    image: `/imgs/IMG_6283.PNG`,
  },
  {
    pos: [TILE_SPACE, TILE_SPACE, 0],
    image: `/imgs/IMG_6284.PNG`,
  },
  {
    pos: [-TILE_SPACE, 0, 0],
    image: `/imgs/IMG_6286.PNG`,
  },
  {
    pos: [0, 0, 0],
    image: `/imgs/IMG_6287.PNG`,
  },
  {
    pos: [TILE_SPACE, 0, 0],
    image: `/imgs/IMG_6289.PNG`,
  },
  {
    pos: [-TILE_SPACE, -TILE_SPACE, 0],
    image: `/imgs/IMG_6290.PNG`,
  },
  {
    pos: [0, -TILE_SPACE, 0],
    image: `/imgs/IMG_6291.PNG`,
  },
  {
    pos: [TILE_SPACE, -TILE_SPACE, 0],
    image: `/imgs/IMG_6292.PNG`,
  },
];

// clone groups
const TILE_GROUPS = [
  {
    pos: [GRID_SIZE * -1, GRID_SIZE * 1, 0],
  },
  {
    pos: [0, GRID_SIZE, 0],
  },
  {
    pos: [GRID_SIZE, GRID_SIZE, 0],
  },
  {
    pos: [GRID_SIZE * -1, 0, 0],
  },
  {
    pos: [0, 0, 0],
  },
  {
    pos: [GRID_SIZE, 0, 0],
  },
  {
    pos: [GRID_SIZE * -1, GRID_SIZE * -1, 0],
  },
  {
    pos: [0, GRID_SIZE * -1, 0],
  },
  {
    pos: [GRID_SIZE, GRID_SIZE * -1, 0],
  },
];

const reducedMotionMediaQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
);

// full screen postprocessing shader
const distortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: new THREE.Vector2() },
    uScreenRes: { value: new THREE.Vector2() },
    uReducedMotion: { value: reducedMotionMediaQuery.matches ? 1.0 : 0.0 },
  },
  vertexShader: document.getElementById("vertexShader").textContent,
  fragmentShader: document.getElementById("fragmentShader").textContent,
};

class App {
  constructor() {
    this.init();
    this.setupRenderer();
    this.setupCamera();
    this.setupScene();
    this.setupComposer();

    // this.addSettings();

    this.resize();
    this.setupListeners();
    this.setupReducedMotionListeners();

    this.render();
  }

  init() {
    this.direction = {
      x: 1,
      y: 1,
    };
    this.scroll = {
      ease: 0.05,
      scale: 0.02,
      current: {
        x: 0,
        y: 0,
      },
      target: {
        x: 0,
        y: 0,
      },
      last: {
        x: 0,
        y: 0,
      },
    };
    TILE_GROUPS.forEach((obj) => {
      obj.offset = { x: 0, y: 0 };
      obj.group = new THREE.Group();
    });
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      // antialias: true,
      alpha: true,
    });
    document.body.appendChild(this.renderer.domElement);
    this.renderer.setClearColor(0x000000);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      1,
      1000
    );
    this.camera.position.z = 10;
    // this.camera.position.z = 40;
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.addObjects();
    // this.addLighting();
  }

  setupComposer() {
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);
    const shaderPass = new ShaderPass(
      new THREE.ShaderMaterial(distortionShader),
      "tDiffuse"
    );
    this.composer.addPass(shaderPass);
  }

  addSettings() {
    this.gui = new dat.GUI();
    this.settings = { progress: 0 };
    this.gui.add(this.settings, "progress", 0, 1, 0.01);
  }

  addLighting() {
    // ambient light
    this.light1 = new THREE.AmbientLight(0x404040);
    this.scene.add(this.light1);

    // point light
    this.light2 = new THREE.PointLight(0xffffff, 1, 100);
    this.light2.position.set(2, 2, 2);
    this.scene.add(this.light2);
  }

  addObjects() {
    TILES.forEach((tile, i) => {
      let imageTexture = new THREE.TextureLoader().load(tile.image);
      let geometry = new THREE.PlaneBufferGeometry(TILE_SIZE, TILE_SIZE);
      let material = new THREE.MeshBasicMaterial({ map: imageTexture });
      let mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...tile.pos);
      TILE_GROUPS.forEach((obj) => obj.group.add(mesh.clone()));
    });
    TILE_GROUPS.forEach((obj) => this.scene.add(obj.group));
  }

  setPositions() {
    let scrollX = this.scroll?.current.x;
    let scrollY = this.scroll?.current.y;
    TILE_GROUPS.forEach(({ offset, pos, group }, i) => {
      let posX = pos[0] + scrollX + offset.x;
      let posY = pos[1] + scrollY + offset.y;
      let dir = this.direction;
      let groupOff = GRID_SIZE / 2;
      let viewportOff = {
        x: this.viewport.width / 2,
        y: this.viewport.height / 2,
      };

      group.position.set(posX, posY, pos[2]);

      // if a group is off screen move it to the opposite side of the entire grid
      // offset is added to the grid position on next call
      // horizontal
      if (dir.x < 0 && posX - groupOff > viewportOff.x) {
        TILE_GROUPS[i].offset.x -= TOTAL_GRID_SIZE;
      } else if (dir.x > 0 && posX + groupOff < -viewportOff.x) {
        TILE_GROUPS[i].offset.x += TOTAL_GRID_SIZE;
      }
      // vertical
      if (dir.y < 0 && posY - groupOff > viewportOff.y) {
        TILE_GROUPS[i].offset.y -= TOTAL_GRID_SIZE;
      } else if (dir.y > 0 && posY + groupOff < -viewportOff.y) {
        TILE_GROUPS[i].offset.y += TOTAL_GRID_SIZE;
      }
    });
  }

  resize() {
    this.screen = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.composer.setSize(this.screen.width, this.screen.height);
    this.camera.aspect = this.screen.width / this.screen.height;
    this.camera.updateProjectionMatrix();

    // mobile
    if (this.screen.width < 768) {
      this.camera.position.z = 20;
      this.scroll.scale = 0.08;
    } else {
      this.camera.position.z = 10;
      this.scroll.scale = 0.02;
    }

    // update screen res uniform
    distortionShader.uniforms.uScreenRes.value = new THREE.Vector2(
      this.screen.width,
      this.screen.height
    );

    // calculate viewport size in world units (not pixel units) 🤯
    const fov = this.camera.fov * (Math.PI / 180);
    const height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    const width = height * this.camera.aspect;
    this.viewport = {
      height,
      width,
    };
    this.setPositions();
  }

  onTouchDown(e) {
    this.isDown = true;
    this.scroll.position = {
      x: this.scroll.current.x,
      y: this.scroll.current.y,
    };
    this.startX = e.touches ? e.touches[0].clientX : e.clientX;
    this.startY = e.touches ? e.touches[0].clientY : e.clientY;
  }

  onTouchMove(e) {
    if (!this.isDown) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const distanceX = (this.startX - x) * this.scroll.scale;
    const distanceY = (this.startY - y) * this.scroll.scale;

    this.scroll.target = {
      x: this.scroll.position.x - distanceX,
      y: this.scroll.position.y + distanceY,
    };
  }

  onTouchUp(e) {
    this.isDown = false;
  }

  onWheel(e) {
    e.preventDefault();
    let normalized = normalizeWheel(e);
    this.scroll.target.x -= normalized.pixelX * this.scroll.scale;
    this.scroll.target.y += normalized.pixelY * this.scroll.scale;
  }

  setupListeners() {
    window.addEventListener("resize", this.resize.bind(this));

    window.addEventListener("wheel", this.onWheel.bind(this));
    window.addEventListener("mousewheel", this.onWheel.bind(this));

    window.addEventListener("mousedown", this.onTouchDown.bind(this));
    window.addEventListener("mousemove", this.onTouchMove.bind(this));
    window.addEventListener("mouseup", this.onTouchUp.bind(this));

    window.addEventListener("touchstart", this.onTouchDown.bind(this));
    window.addEventListener("touchmove", this.onTouchMove.bind(this));
    window.addEventListener("touchend", this.onTouchUp.bind(this));
  }

  setupReducedMotionListeners() {
    const reducedMotionCheckbox = document.querySelector(
      "#reduced-motion-toggle input"
    );

    if (reducedMotionMediaQuery.matches) {
      reducedMotionCheckbox.checked = true;
    }

    reducedMotionCheckbox.addEventListener("change", (e) => {
      distortionShader.uniforms.uReducedMotion.value = e.target.checked
        ? 1.0
        : 0.0;
    });
  }

  render() {
    this.composer.render();
    // this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => {
      this.scroll.current = {
        x: lerp(this.scroll.current.x, this.scroll.target.x, this.scroll.ease),
        y: lerp(this.scroll.current.y, this.scroll.target.y, this.scroll.ease),
      };

      // vertical dir
      if (this.scroll.current.y > this.scroll.last.y) {
        this.direction.y = -1;
      } else if (this.scroll.current.y < this.scroll.last.y) {
        this.direction.y = 1;
      }
      // horizontal dir
      if (this.scroll.current.x > this.scroll.last.x) {
        this.direction.x = -1;
      } else if (this.scroll.current.x < this.scroll.last.x) {
        this.direction.x = 1;
      }

      distortionShader.uniforms.uStrength.value = new THREE.Vector2(
        Math.abs(
          ((this.scroll.current.x - this.scroll.last.x) / this.screen.width) *
            10
        ),
        Math.abs(
          ((this.scroll.current.y - this.scroll.last.y) / this.screen.width) *
            10
        )
      );

      this.setPositions();

      this.scroll.last = {
        x: this.scroll.current.x,
        y: this.scroll.current.y,
      };

      this.render();
    });
  }
}

new App();

function lerp(start, end, amount) {
  return start * (1 - amount) + end * amount;
}

(function () {
  var touchStartHandler, touchMoveHandler, touchPoint;

  // Only needed for touch events on chrome.
  if (
    (window.chrome || navigator.userAgent.match("CriOS")) &&
    "ontouchstart" in document.documentElement
  ) {
    touchStartHandler = function () {
      // Only need to handle single-touch cases
      touchPoint = event.touches.length === 1 ? event.touches[0].clientY : null;
    };

    touchMoveHandler = function (event) {
      var newTouchPoint;

      // Only need to handle single-touch cases
      if (event.touches.length !== 1) {
        touchPoint = null;

        return;
      }

      // We only need to defaultPrevent when scrolling up
      newTouchPoint = event.touches[0].clientY;
      if (newTouchPoint > touchPoint) {
        event.preventDefault();
      }
      touchPoint = newTouchPoint;
    };

    document.addEventListener("touchstart", touchStartHandler, {
      passive: false,
    });

    document.addEventListener("touchmove", touchMoveHandler, {
      passive: false,
    });
  }
})();
