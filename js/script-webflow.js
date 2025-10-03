import Lenis from "lenis";
import gsap from "gsap";
import { CustomEase } from "gsap/all";
import * as THREE from "three";

import { resizeThreeCanvas, calcFov, debounce, lerp } from "./utils";

import baseVertex from "../shader/baseVertex.glsl";
import baseFragment from "../shader/baseFragment.glsl";
import effectVertex from "../shader/effectVertex.glsl";
import effectFragment from "../shader/effectFragment.glsl";

// Initialize Lenis smooth scroll globally (always runs)
let scroll = {
	scrollY: window.scrollY,
	scrollVelocity: 0,
};

const lenis = new Lenis();

lenis.on("scroll", (e) => {
	scroll.scrollY = window.scrollY;
	scroll.scrollVelocity = e.velocity;
});

function scrollRaf(time) {
	lenis.raf(time);
	requestAnimationFrame(scrollRaf);
}

requestAnimationFrame(scrollRaf);

// Main initialization function that runs when DOM is ready
function initShaderOnScroll() {
	// Check if required elements exist
	const mediaElements = document.querySelectorAll(
		"[data-webgl-media='true']"
	);

	if (mediaElements.length === 0) {
		console.warn(
			"ShaderOnScroll: No elements with [data-webgl-media='true'] attribute found. Lenis smooth scroll is still active."
		);
		return;
	}

	gsap.registerPlugin(CustomEase);

	// Constants
	const CAMERA_POS = 500;

	// cursor position
	let cursorPos = {
		current: { x: 0.5, y: 0.5 },
		target: { x: 0.5, y: 0.5 },
	};

	let cursorRaf;

	const lerpCursorPos = () => {
		const x = lerp(cursorPos.current.x, cursorPos.target.x, 0.05);
		const y = lerp(cursorPos.current.y, cursorPos.target.y, 0.05);

		cursorPos.current.x = x;
		cursorPos.current.y = y;

		const delta = Math.sqrt(
			(cursorPos.target.x - cursorPos.current.x) ** 2 +
				(cursorPos.target.y - cursorPos.current.y) ** 2
		);

		if (delta < 0.001 && cursorRaf) {
			cancelAnimationFrame(cursorRaf);
			cursorRaf = null;
			return;
		}

		cursorRaf = requestAnimationFrame(lerpCursorPos);
	};

	window.addEventListener("mousemove", (event) => {
		cursorPos.target.x = event.clientX / window.innerWidth;
		cursorPos.target.y = event.clientY / window.innerHeight;

		if (!cursorRaf) {
			cursorRaf = requestAnimationFrame(lerpCursorPos);
		}
	});

	// helper for image-to-webgl and uniform updates
	// this lerps when entering the texture with cursor
	const handleMouseEnter = (index) => {
		gsap.to(mediaStore[index], {
			mouseEnter: 1,
			duration: 0.6,
			ease: CustomEase.create("custom", "0.4, 0, 0.2, 1"),
		});
	};

	// this updates the cursor position uniform on the texture
	const handleMousePos = (e, index) => {
		const bounds = mediaStore[index].media.getBoundingClientRect();
		const x = e.offsetX / bounds.width;
		const y = e.offsetY / bounds.height;

		mediaStore[index].mouseOverPos.target.x = x;
		mediaStore[index].mouseOverPos.target.y = y;
	};

	// this lerps when leaving the texture with cursor
	const handleMouseLeave = (index) => {
		gsap.to(mediaStore[index], {
			mouseEnter: 0,
			duration: 0.6,
			ease: CustomEase.create("custom", "0.4, 0, 0.2, 1"),
		});
		gsap.to(mediaStore[index].mouseOverPos.target, {
			x: 0.5,
			y: 0.5,
			duration: 0.6,
			ease: CustomEase.create("custom", "0.4, 0, 0.2, 1"),
		});
	};

	// this gets all image html tags and creates individual canvas and renderer for each
	const setMediaStore = (scrollY) => {
		const media = [
			...document.querySelectorAll("[data-webgl-media='true']"),
		];

		console.log(
			`Found ${media.length} images with data-webgl-media="true"`
		);

		mediaStore = media
			.map((media, i) => {
				console.log(`Processing image ${i}:`, media);
				observer.observe(media);

				media.dataset.index = String(i);
				media.addEventListener("mouseenter", () => handleMouseEnter(i));
				media.addEventListener("mousemove", (e) =>
					handleMousePos(e, i)
				);
				media.addEventListener("mouseleave", () => handleMouseLeave(i));

				const bounds = media.getBoundingClientRect();

				// Create individual canvas for this image
				let canvas = media.nextElementSibling;
				if (!canvas || canvas.tagName !== "CANVAS") {
					canvas = document.createElement("canvas");
					canvas.style.position = "absolute";
					canvas.style.top = "0";
					canvas.style.left = "0";
					canvas.style.width = "100%";
					canvas.style.height = "100%";
					canvas.style.pointerEvents = "none";
					canvas.style.zIndex = "0";

					// Make parent relative if not already positioned
					const parent = media.parentNode;
					const parentStyle = getComputedStyle(parent);
					if (parentStyle.position === "static") {
						parent.style.position = "relative";
					}

					// Insert canvas as next sibling to media element
					media.parentNode.insertBefore(canvas, media.nextSibling);
					console.log(`Canvas created for image ${i}`, canvas);
				} else {
					console.log(`Canvas already exists for image ${i}`, canvas);
				}

				// Verify canvas is properly referenced
				if (!canvas) {
					console.error(`Canvas is null for image ${i}!`);
					return null;
				}

				// Create individual scene and renderer for this image
				const individualScene = new THREE.Scene();
				const camera = new THREE.PerspectiveCamera(
					50,
					bounds.width / bounds.height,
					0.1,
					1000
				);
				camera.position.z = CAMERA_POS;
				camera.fov = calcFov(CAMERA_POS);
				camera.updateProjectionMatrix();

				try {
					const renderer = new THREE.WebGLRenderer({
						canvas: canvas,
						alpha: true,
						antialias: true,
					});
					renderer.setSize(bounds.width, bounds.height);
					renderer.setPixelRatio(
						Math.min(window.devicePixelRatio, 2)
					);
					// Set clear color to transparent
					renderer.setClearColor(0x000000, 0);

					const imageMaterial = material.clone();
					const imageMesh = new THREE.Mesh(geometry, imageMaterial);

					let texture = null;

					// Create texture with proper CORS and WebGL handling
					const createTexture = (imageElement) => {
						const tex = new THREE.Texture(imageElement);
						tex.wrapS = THREE.ClampToEdgeWrapping;
						tex.wrapT = THREE.ClampToEdgeWrapping;
						tex.minFilter = THREE.LinearFilter;
						tex.magFilter = THREE.LinearFilter;
						tex.generateMipmaps = false;
						tex.needsUpdate = true;
						return tex;
					};

					// Try to load image with CORS handling
					if (media.src && media.tagName.toLowerCase() === "img") {
						const img = new Image();
						img.crossOrigin = "anonymous";

						img.onload = () => {
							texture = createTexture(img);
							imageMaterial.uniforms.uTexture.value = texture;
							imageMaterial.uniforms.uTextureSize.value.x =
								img.naturalWidth || 1;
							imageMaterial.uniforms.uTextureSize.value.y =
								img.naturalHeight || 1;
						};

						img.onerror = () => {
							// Fallback: use original image without CORS
							console.warn(
								"CORS loading failed for image, using original:",
								media.src
							);
							texture = createTexture(media);
							imageMaterial.uniforms.uTexture.value = texture;
							imageMaterial.uniforms.uTextureSize.value.x =
								media.naturalWidth || 1;
							imageMaterial.uniforms.uTextureSize.value.y =
								media.naturalHeight || 1;
						};

						img.src = media.src;
					} else {
						// Fallback for non-image elements or images without src
						texture = createTexture(media);
						imageMaterial.uniforms.uTexture.value = texture;
						imageMaterial.uniforms.uTextureSize.value.x =
							media.naturalWidth || 1;
						imageMaterial.uniforms.uTextureSize.value.y =
							media.naturalHeight || 1;
					}

					imageMaterial.uniforms.uQuadSize.value.x = bounds.width;
					imageMaterial.uniforms.uQuadSize.value.y = bounds.height;
					imageMaterial.uniforms.uBorderRadius.value =
						getComputedStyle(media).borderRadius.replace("px", "");

					// Calculate proper mesh scale to fill viewport with slight overdraw
					const fov = camera.fov * (Math.PI / 180);
					const distance = camera.position.z;
					const height = 2 * Math.tan(fov / 2) * distance;
					const width = height * camera.aspect;

					// Scale mesh to fill the entire canvas viewport with 1% overdraw to ensure full coverage
					imageMesh.scale.set(width * 1.01, height * 1.01, 1);
					imageMesh.position.set(0, 0, 0);

					individualScene.add(imageMesh);

					// Check for hover-only mode using dedicated attribute
					const hoverOnly =
						media.getAttribute("data-webgl-hover-only") === "true";

					return {
						media,
						canvas,
						scene: individualScene,
						camera,
						renderer,
						material: imageMaterial,
						mesh: imageMesh,
						width: bounds.width,
						height: bounds.height,
						top: bounds.top + scrollY,
						left: bounds.left,
						isInView:
							bounds.top >= -500 &&
							bounds.top <= window.innerHeight + 500,
						mouseEnter: 0,
						hoverOnly, // Store the hover-only setting
						mouseOverPos: {
							current: {
								x: 0.5,
								y: 0.5,
							},
							target: {
								x: 0.5,
								y: 0.5,
							},
						},
					};
				} catch (error) {
					console.error(
						`Failed to create WebGL renderer for image ${i}:`,
						error
					);
					return null;
				}
			})
			.filter(Boolean); // Remove any null entries
	};

	// Remove global positioning since each canvas is positioned individually
	const setPositions = () => {
		// No longer needed - each canvas is positioned relative to its image
	};

	// Shader setup
	let observer;
	let mediaStore;
	let geometry;
	let material;

	// create intersection observer to only render in view elements
	observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				const index = entry.target.dataset.index;

				if (index) {
					mediaStore[parseInt(index)].isInView = entry.isIntersecting;
				}
			});
		},
		{ rootMargin: "500px 0px 500px 0px" }
	);

	// geometry and material template (will be cloned for each image)
	geometry = new THREE.PlaneGeometry(1, 1, 100, 100);
	material = new THREE.ShaderMaterial({
		uniforms: {
			uResolution: {
				value: new THREE.Vector2(window.innerWidth, window.innerHeight),
			},
			uTime: { value: 0 },
			uCursor: { value: new THREE.Vector2(0.5, 0.5) },
			uScrollVelocity: { value: 0 },
			uTexture: { value: null },
			uTextureSize: { value: new THREE.Vector2(100, 100) },
			uQuadSize: { value: new THREE.Vector2(100, 100) },
			uBorderRadius: { value: 0 },
			uMouseEnter: { value: 0 },
			uMouseOverPos: { value: new THREE.Vector2(0.5, 0.5) },
		},
		vertexShader: effectVertex,
		fragmentShader: effectFragment,
		glslVersion: THREE.GLSL3,
	});

	// render loop - now renders each individual canvas
	const render = (time = 0) => {
		time /= 1000;

		if (!mediaStore || mediaStore.length === 0) {
			requestAnimationFrame(render);
			return;
		}

		mediaStore.forEach((object) => {
			if (!object) return; // Skip null objects

			if (object.isInView) {
				object.mouseOverPos.current.x = lerp(
					object.mouseOverPos.current.x,
					object.mouseOverPos.target.x,
					0.05
				);
				object.mouseOverPos.current.y = lerp(
					object.mouseOverPos.current.y,
					object.mouseOverPos.target.y,
					0.05
				);

				object.material.uniforms.uResolution.value.x = object.width;
				object.material.uniforms.uResolution.value.y = object.height;
				object.material.uniforms.uTime.value = time;
				object.material.uniforms.uCursor.value.x = cursorPos.current.x;
				object.material.uniforms.uCursor.value.y = cursorPos.current.y;
				// Apply scroll velocity only if not hover-only mode
				object.material.uniforms.uScrollVelocity.value =
					object.hoverOnly ? 0 : scroll.scrollVelocity;
				object.material.uniforms.uMouseOverPos.value.x =
					object.mouseOverPos.current.x;
				object.material.uniforms.uMouseOverPos.value.y =
					object.mouseOverPos.current.y;
				object.material.uniforms.uMouseEnter.value = object.mouseEnter;

				// Render this individual canvas
				object.renderer.render(object.scene, object.camera);
			}
		});

		requestAnimationFrame(render);
	};

	window.addEventListener(
		"resize",
		debounce(() => {
			mediaStore.forEach((object) => {
				const bounds = object.media.getBoundingClientRect();

				// Update canvas size
				object.renderer.setSize(bounds.width, bounds.height);

				// Update camera aspect ratio
				object.camera.aspect = bounds.width / bounds.height;
				object.camera.fov = calcFov(CAMERA_POS);
				object.camera.updateProjectionMatrix();

				// Recalculate proper mesh scale to fill viewport with slight overdraw
				const fov = object.camera.fov * (Math.PI / 180);
				const distance = object.camera.position.z;
				const height = 2 * Math.tan(fov / 2) * distance;
				const width = height * object.camera.aspect;

				// Update object properties with 1% overdraw to ensure full coverage
				object.mesh.scale.set(width * 1.01, height * 1.01, 1);
				object.width = bounds.width;
				object.height = bounds.height;
				object.top = bounds.top + scroll.scrollY;
				object.left = bounds.left;
				object.isInView =
					bounds.top >= -500 &&
					bounds.top <= window.innerHeight + 500;

				// Update material uniforms
				object.material.uniforms.uResolution.value.x = bounds.width;
				object.material.uniforms.uResolution.value.y = bounds.height;
				object.material.uniforms.uTextureSize.value.x =
					object.media.naturalWidth || 1;
				object.material.uniforms.uTextureSize.value.y =
					object.media.naturalHeight || 1;
				object.material.uniforms.uQuadSize.value.x = bounds.width;
				object.material.uniforms.uQuadSize.value.y = bounds.height;
				object.material.uniforms.uBorderRadius.value = getComputedStyle(
					object.media
				).borderRadius.replace("px", "");
			});
		})
	);

	// Add the preloader logic
	window.addEventListener("load", () => {
		// media details
		setMediaStore(scroll.scrollY);

		requestAnimationFrame(render);

		document.body.classList.remove("loading");
	});
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initShaderOnScroll);
} else {
	// DOM is already ready
	initShaderOnScroll();
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initShaderOnScroll);
} else {
	// DOM is already ready
	initShaderOnScroll();
}
