import Cursor from '../cursor';

import { Stage } from '../../3d/controllers/Stage'
import { Events } from '../../3d/config/Events'
import { TextureLoader } from '../../3d/loaders/world/TextureLoader'
import { getFullscreenTriangle } from '../../3d/utils/world/Utils3D'
import { mix } from '../../3d/utils/Utils'
import { ticker } from '../../3d/tween/Ticker'
import { Reflector } from '../../3d/utils/world/Reflector'
import { FXAAMaterial } from '../../3d/materials/FXAAMaterial'
import { LuminosityMaterial } from '../../3d/materials/LuminosityMaterial'
import { UnrealBloomBlurMaterial } from '../../3d/materials/UnrealBloomBlurMaterial'
import { BloomCompositeMaterial } from '../../3d/materials/BloomCompositeMaterial'
import { ACESFilmicToneMapping, Color, DirectionalLight, Fog, GLSL3, Group, HemisphereLight, MathUtils, Mesh, MeshStandardMaterial, NoBlending, OrthographicCamera, PerspectiveCamera, PlaneGeometry, RGBFormat, RawShaderMaterial, RepeatWrapping, Scene, ShaderMaterial, Uniform, Vector2, Vector3, VideoTexture, WebGLRenderTarget, WebGLRenderer,  } from 'three'

class Config {
    static BG_COLOR = '#0e0e0e';
    static UI_COLOR = 'rgba(255, 255, 255, 0.94)';
}

import rgbshift from '../../3d/shaders/modules/rgbshift/rgbshift.glsl.js';

const vertexCompositeShader = /* glsl */`
            in vec3 position;
            in vec2 uv;

            out vec2 vUv;

            void main() {
                vUv = uv;

                gl_Position = vec4(position, 1.0);
            }
        `;

const fragmentCompositeShader = /* glsl */`
            precision highp float;

            uniform sampler2D tScene;
            uniform sampler2D tBloom;
            uniform float uDistortion;

            in vec2 vUv;

            out vec4 FragColor;

            ${rgbshift}

            void main() {
                FragColor = texture(tScene, vUv);

                float angle = length(vUv - 0.5);
                float amount = 0.0002 + uDistortion;

                FragColor.rgb += getRGB(tBloom, vUv, angle, amount).rgb;
            }
        `;

class CompositeMaterial extends RawShaderMaterial {
    constructor() {
        super({
            glslVersion: GLSL3,
            uniforms: {
                tScene: new Uniform(null),
                tBloom: new Uniform(null),
                uDistortion: new Uniform(0.00125)
            },
            vertexShader: vertexCompositeShader,
            fragmentShader: fragmentCompositeShader,
            blending: NoBlending,
            depthWrite: false,
            depthTest: false
        });
    }
}

// https://vimeo.com/69949278

class Triangle extends Group {
    constructor() {
        super();
    }

    async initMesh() {
        const { camera } = WorldController;

        const videoElement = document.getElementById('reel');
        videoElement.play();
        const videoTexture = new VideoTexture(videoElement);

        const group = new Group();
        group.position.set(0, 1.4, -11);
        group.lookAt(camera.position);

        // const geometry = new PlaneGeometry(8,4.5);
        // const geometry = new PlaneGeometry(8.8,4.95);
        const geometry = new PlaneGeometry(9.6,5.4);
        // const material = new MeshStandardMaterial({ emissive: 0xffffff });
        const material = new ShaderMaterial({
            uniforms: {
                // uColor: { value: new Color(0., 0.8, 0.5)}
                uTexture: { value: videoTexture }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vec3 pos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.);
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                varying vec2 vUv;
                void main() {
                    vec3 texture = texture2D(uTexture, vUv).rgb;
                    gl_FragColor = vec4(texture, 1.);
                }
            `
        });

        geometry.center();
        const mesh = new Mesh(geometry, material);
        group.add(mesh);

        this.add(group);
    }
}

class Floor extends Group {
    constructor() {
        super();

        this.initReflector();
    }

    initReflector() {
        this.reflector = new Reflector();
    }

    async initMesh() {
        const { loadTexture } = WorldController;

        const geometry = new PlaneGeometry(110, 110);

        // 2nd set of UV's for aoMap and lightMap
        geometry.attributes.uv2 = geometry.attributes.uv;

        // Textures
        const [map, normalMap, ormMap] = await Promise.all([
            // loadTexture('assets/textures/uv.jpg'),
            loadTexture('./textures/pbr/polished_concrete_basecolor.jpg'),
            loadTexture('./textures/pbr/polished_concrete_normal.jpg'),
            // https://occlusion-roughness-metalness.glitch.me/
            loadTexture('./textures/pbr/polished_concrete_orm.jpg')
        ]);

        map.wrapS = RepeatWrapping;
        map.wrapT = RepeatWrapping;
        map.repeat.set(16, 16);

        normalMap.wrapS = RepeatWrapping;
        normalMap.wrapT = RepeatWrapping;
        normalMap.repeat.set(16, 16);

        ormMap.wrapS = RepeatWrapping;
        ormMap.wrapT = RepeatWrapping;
        ormMap.repeat.set(16, 16);

        const material = new MeshStandardMaterial({
            roughness: 0.35,
            metalness: 0.18,
            map,
            aoMap: ormMap,
            aoMapIntensity: 1,
            roughnessMap: ormMap,
            metalnessMap: ormMap,
            normalMap,
            normalScale: new Vector2(3, 3),
            dithering: true
        });

        material.onBeforeCompile = shader => {
            shader.uniforms.reflectMap = this.reflector.renderTargetUniform;
            shader.uniforms.textureMatrix = this.reflector.textureMatrixUniform;

            shader.vertexShader = shader.vertexShader.replace(
                'void main() {',
                        /* glsl */`
                        uniform mat4 textureMatrix;
                        out vec4 vCoord;

                        void main() {
                        `
            );

            shader.vertexShader = shader.vertexShader.replace(
                '#include <project_vertex>',
                        /* glsl */`
                        #include <project_vertex>

                        vCoord = textureMatrix * vec4(transformed, 1.0);
                        `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                'void main() {',
                        /* glsl */`
                        uniform sampler2D reflectMap;
                        in vec4 vCoord;

                        void main() {
                        `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                'vec3 totalEmissiveRadiance = emissive;',
                        /* glsl */`
                        vec3 totalEmissiveRadiance = emissive;

                        totalEmissiveRadiance += textureProj(reflectMap, vCoord).rgb * 0.2;
                        `
            );
        };

        const mesh = new Mesh(geometry, material);
        mesh.position.y = -1.6;
        mesh.rotation.x = -Math.PI / 2;
        mesh.add(this.reflector);

        mesh.onBeforeRender = (renderer, scene, camera) => {
            this.visible = false;
            this.reflector.update(renderer, scene, camera);
            this.visible = true;
        };

        this.add(mesh);
    }

    /**
     * Public methods
     */

    resize = (width, height) => {
        width = MathUtils.floorPowerOfTwo(width) / 2;
        height = 1024;

        this.reflector.setSize(width, height);
    };
}

class SceneView extends Group {
    constructor() {
        super();

        this.visible = false;

        this.initViews();
    }

    initViews() {
        this.floor = new Floor();
        this.add(this.floor);

        this.triangle = new Triangle();
        this.add(this.triangle);
    }

    /**
     * Public methods
     */

    resize = (width, height) => {
        this.floor.resize(width, height);
    };

    ready = () => Promise.all([
        this.floor.initMesh(),
        this.triangle.initMesh()
    ]);
}

class SceneController {
    static init(view) {
        this.view = view;
    }

    /**
     * Public methods
     */

    static resize = (width, height) => {
        this.view.resize(width, height);
    };

    static update = () => {
    };

    static animateIn = () => {
        this.view.visible = true;
    };

    static ready = () => this.view.ready();
}

const BlurDirectionX = new Vector2(1, 0);
const BlurDirectionY = new Vector2(0, 1);

class RenderManager {
    static init(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;

        this.luminosityThreshold = 0.1;
        this.bloomStrength = 0.3;
        this.bloomRadius = 0.75;
        this.enabled = true;

        this.initRenderer();
    }

    static initRenderer() {
        const { screenTriangle, resolution } = WorldController;

        // Fullscreen triangle
        this.screenScene = new Scene();
        this.screenCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

        this.screen = new Mesh(screenTriangle);
        this.screen.frustumCulled = false;
        this.screenScene.add(this.screen);

        // Render targets
        this.renderTargetA = new WebGLRenderTarget(1, 1, {
            format: RGBFormat,
            depthBuffer: false
        });

        this.renderTargetB = this.renderTargetA.clone();

        this.renderTargetsHorizontal = [];
        this.renderTargetsVertical = [];
        this.nMips = 5;

        this.renderTargetBright = this.renderTargetA.clone();

        for (let i = 0, l = this.nMips; i < l; i++) {
            this.renderTargetsHorizontal.push(this.renderTargetA.clone());
            this.renderTargetsVertical.push(this.renderTargetA.clone());
        }

        this.renderTargetA.depthBuffer = true;

        // FXAA material
        this.fxaaMaterial = new FXAAMaterial();
        this.fxaaMaterial.uniforms.uResolution = resolution;

        // Luminosity high pass material
        this.luminosityMaterial = new LuminosityMaterial();
        this.luminosityMaterial.uniforms.uLuminosityThreshold.value = this.luminosityThreshold;

        // Gaussian blur materials
        this.blurMaterials = [];

        const kernelSizeArray = [3, 5, 7, 9, 11];

        for (let i = 0, l = this.nMips; i < l; i++) {
            this.blurMaterials.push(new UnrealBloomBlurMaterial(kernelSizeArray[i]));
            this.blurMaterials[i].uniforms.uResolution.value = new Vector2();
        }

        // Bloom composite material
        const bloomFactors = [1, 0.8, 0.6, 0.4, 0.2];

        for (let i = 0, l = this.nMips; i < l; i++) {
            const factor = bloomFactors[i];
            bloomFactors[i] = this.bloomStrength * mix(factor, 1.2 - factor, this.bloomRadius);
        }

        this.bloomCompositeMaterial = new BloomCompositeMaterial(this.nMips);
        this.bloomCompositeMaterial.uniforms.tBlur1.value = this.renderTargetsVertical[0].texture;
        this.bloomCompositeMaterial.uniforms.tBlur2.value = this.renderTargetsVertical[1].texture;
        this.bloomCompositeMaterial.uniforms.tBlur3.value = this.renderTargetsVertical[2].texture;
        this.bloomCompositeMaterial.uniforms.tBlur4.value = this.renderTargetsVertical[3].texture;
        this.bloomCompositeMaterial.uniforms.tBlur5.value = this.renderTargetsVertical[4].texture;
        this.bloomCompositeMaterial.uniforms.uBloomFactors.value = bloomFactors;

        // Composite material
        this.compositeMaterial = new CompositeMaterial();
    }

    /**
     * Public methods
     */

    static resize = (width, height, dpr) => {
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(width, height);

        width = Math.round(width * dpr);
        height = Math.round(height * dpr);

        this.renderTargetA.setSize(width, height);
        this.renderTargetB.setSize(width, height);

        width = MathUtils.floorPowerOfTwo(width) / 2;
        height = MathUtils.floorPowerOfTwo(height) / 2;

        this.renderTargetBright.setSize(width, height);

        for (let i = 0, l = this.nMips; i < l; i++) {
            this.renderTargetsHorizontal[i].setSize(width, height);
            this.renderTargetsVertical[i].setSize(width, height);

            this.blurMaterials[i].uniforms.uResolution.value.set(width, height);

            width = width / 2;
            height = height / 2;
        }
    };

    static update = () => {
        const renderer = this.renderer;
        const scene = this.scene;
        const camera = this.camera;

        if (!this.enabled) {
            renderer.setRenderTarget(null);
            renderer.render(scene, camera);
            return;
        }

        const screenScene = this.screenScene;
        const screenCamera = this.screenCamera;

        const renderTargetA = this.renderTargetA;
        const renderTargetB = this.renderTargetB;
        const renderTargetBright = this.renderTargetBright;
        const renderTargetsHorizontal = this.renderTargetsHorizontal;
        const renderTargetsVertical = this.renderTargetsVertical;

        // Scene pass
        renderer.setRenderTarget(renderTargetA);
        renderer.render(scene, camera);

        // FXAA pass
        this.fxaaMaterial.uniforms.tMap.value = renderTargetA.texture;
        this.screen.material = this.fxaaMaterial;
        renderer.setRenderTarget(renderTargetB);
        renderer.render(screenScene, screenCamera);

        // Extract bright areas
        // this.luminosityMaterial.uniforms.tMap.value = renderTargetB.texture;
        // this.screen.material = this.luminosityMaterial;
        // renderer.setRenderTarget(renderTargetBright);
        // renderer.render(screenScene, screenCamera);

        // Blur all the mips progressively
        // let inputRenderTarget = renderTargetBright;

        // for (let i = 0, l = this.nMips; i < l; i++) {
        //     this.screen.material = this.blurMaterials[i];

        //     this.blurMaterials[i].uniforms.tMap.value = inputRenderTarget.texture;
        //     this.blurMaterials[i].uniforms.uDirection.value = BlurDirectionX;
        //     renderer.setRenderTarget(renderTargetsHorizontal[i]);
        //     renderer.render(screenScene, screenCamera);

        //     this.blurMaterials[i].uniforms.tMap.value = this.renderTargetsHorizontal[i].texture;
        //     this.blurMaterials[i].uniforms.uDirection.value = BlurDirectionY;
        //     renderer.setRenderTarget(renderTargetsVertical[i]);
        //     renderer.render(screenScene, screenCamera);

        //     inputRenderTarget = renderTargetsVertical[i];
        // }

        // Composite all the mips
        // this.screen.material = this.bloomCompositeMaterial;
        // renderer.setRenderTarget(renderTargetsHorizontal[0]);
        // renderer.render(screenScene, screenCamera);

        // Composite pass (render to screen)
        this.compositeMaterial.uniforms.tScene.value = renderTargetB.texture;
        this.compositeMaterial.uniforms.tBloom.value = renderTargetsHorizontal[0].texture;
        this.screen.material = this.compositeMaterial;
        renderer.setRenderTarget(null);
        renderer.render(screenScene, screenCamera);
    };
}

class CameraController {
    static init(camera) {
        this.camera = camera;

        this.mouse = new Vector2();
        this.lookAt = new Vector3(0, 0, -2);
        this.origin = new Vector3();
        this.target = new Vector3();
        this.targetXY = new Vector2(5, 1);
        this.origin.copy(this.camera.position);

        this.lerpSpeed = 0.02;
        this.enabled = false;

        this.addListeners();
    }

    static addListeners() {
        Stage.element.addEventListener('pointerdown', this.onPointerDown);
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
    }

    /**
     * Event handlers
     */

    static onPointerDown = e => {
        this.onPointerMove(e);
    };

    static onPointerMove = ({ clientX, clientY }) => {
        if (!this.enabled) {
            return;
        }

        this.mouse.x = (clientX / Stage.width) * 2 - 1;
        this.mouse.y = 1 - (clientY / Stage.height) * 2;
    };

    static onPointerUp = e => {
        this.onPointerMove(e);
    };

    /**
     * Public methods
     */

    static resize = (width, height) => {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        if (width < height) {
            this.camera.position.z = 14;
        } else {
            this.camera.position.z = 10;
        }

        this.origin.z = this.camera.position.z;
    };

    static update = () => {
        if (!this.enabled) {
            return;
        }

        this.target.x = this.origin.x + this.targetXY.x * this.mouse.x;
        this.target.y = this.origin.y + this.targetXY.y * this.mouse.y;
        this.target.z = this.origin.z;

        this.camera.position.lerp(this.target, this.lerpSpeed);
        this.camera.lookAt(this.lookAt);
    };

    static animateIn = () => {
        this.enabled = true;
    };
}

class WorldController {
    static init() {
        this.initWorld();
        this.initLights();
        this.initLoaders();

        this.addListeners();
    }

    static initWorld() {
        this.renderer = new WebGLRenderer({
            powerPreference: 'high-performance',
            stencil: false
        });
        this.element = this.renderer.domElement;

        // Tone mapping
        this.renderer.toneMapping = ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        // 3D scene
        this.scene = new Scene();
        this.scene.background = new Color(Config.BG_COLOR);
        this.scene.fog = new Fog(Config.BG_COLOR, 1, 100);
        this.camera = new PerspectiveCamera(30);
        this.camera.near = 0.5;
        this.camera.far = 50;
        this.camera.position.z = 10;
        this.camera.lookAt(this.scene.position);

        // Global geometries
        this.screenTriangle = getFullscreenTriangle();

        // Global uniforms
        this.resolution = new Uniform(new Vector2());
        this.aspect = new Uniform(1);
        this.time = new Uniform(0);
        this.frame = new Uniform(0);
    }

    static initLights() {
        this.scene.add(new HemisphereLight(0x606060, 0x404040));

        const light = new DirectionalLight(0xffffff);
        light.position.set(1, 1, 1);
        this.scene.add(light);
    }

    static initLoaders() {
        this.textureLoader = new TextureLoader();
    }

    static addListeners() {
        this.renderer.domElement.addEventListener('touchstart', this.onTouchStart);
    }

    /**
     * Event handlers
     */

    static onTouchStart = e => {
        e.preventDefault();
    };

    /**
     * Public methods
     */

    static resize = (width, height, dpr) => {
        width = Math.round(width * dpr);
        height = Math.round(height * dpr);

        this.resolution.value.set(width, height);
        this.aspect.value = width / height;
    };

    static update = (time, delta, frame) => {
        this.time.value = time;
        this.frame.value = frame;
    };

    static getTexture = (path, callback) => this.textureLoader.load(path, callback);

    static loadTexture = path => this.textureLoader.loadAsync(path);
}

class App {
    static async init() {
        this.initWorld();
        this.initViews();
        this.initControllers();

        this.addListeners();
        this.onResize();

        await Promise.all([
            WorldController.textureLoader.ready(),
            SceneController.ready()
        ]);

        CameraController.animateIn();
        SceneController.animateIn();
    }

    static initWorld() {
        WorldController.init();
        Stage.add(WorldController.element);
    }

    static initViews() {
        this.view = new SceneView();
        WorldController.scene.add(this.view);
    }

    static initControllers() {
        const { renderer, scene, camera } = WorldController;

        CameraController.init(camera);
        SceneController.init(this.view);
        RenderManager.init(renderer, scene, camera);
    }

    static addListeners() {
        Stage.events.on(Events.RESIZE, this.onResize);
        ticker.add(this.onUpdate);
    }

    /**
     * Event handlers
     */

    static onResize = () => {
        const { width, height, dpr } = Stage;

        WorldController.resize(width, height, dpr);
        CameraController.resize(width, height);
        SceneController.resize(width, height);
        RenderManager.resize(width, height, dpr);
    };

    static onUpdate = (time, delta, frame) => {
        WorldController.update(time, delta, frame);
        CameraController.update();
        SceneController.update();
        RenderManager.update(time, delta, frame);
    };
}

class Home {
    namespace = 'home';
    beforeEnter = data => {
        console.log('Home beforeEnter')
        // Once
        if (data.current.namespace === '') {
            // eslint-disable-next-line no-unused-vars
            let c = new Cursor({
                inner: document.getElementById('cursor__inner'),
                outer: document.getElementById('cursor__outer')
            });
        }
    }
    afterEnter = data => {
        console.log('Home afterEnter', data)
        App.init();
    }
    beforeLeave = data => {
        console.log('Home beforeLeave', data)
    }
    afterLeave = data => {
        console.log('Home afterLeave', data)
    }

}

export default new Home();