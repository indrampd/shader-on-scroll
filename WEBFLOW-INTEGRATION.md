# Webflow Integration Guide

## Building for Webflow

To create a Webflow-ready version of your shader effect, run:

```bash
npm run build:webflow
```

This will generate a single minified JavaScript file at `dist/shader-on-scroll.min.js` (approximately 558KB, 148KB gzipped).

## Using in Webflow

### Step 1: HTML Structure Requirements ⚠️ IMPORTANT

**Your Webflow page needs:**

**Images with the `data-webgl-media` attribute** - For each image you want the shader effect on:

```html
<img src="your-image.jpg" data-webgl-media="true" alt="Description" />
```

Or in Webflow: Add a custom attribute to your image elements:

-   Attribute Name: `data-webgl-media`
-   Attribute Value: `true`

**Important Notes:**

-   Each image will automatically get its own canvas element positioned as its sibling
-   The parent container of each image will be set to `position: relative` if needed
-   Canvas elements are positioned absolutely over their corresponding images
-   No manual canvas setup required!

### Step 2: Upload the JavaScript file

1. In your Webflow project, go to the Assets panel
2. Upload the `dist/shader-on-scroll.min.js` file
3. Copy the generated asset URL

### Step 3: Add to your Webflow page

1. Go to your page settings or site settings
2. In the "Before </body> tag" section, add:

```html
<script src="YOUR_ASSET_URL_HERE"></script>
```

### Step 4: Include Required CSS

You'll also need to include your CSS files. You can either:

1. Copy the CSS content into Webflow's custom CSS section, or
2. Upload the CSS files as assets and link them

## External Lenis Integration

The shader script now supports using an externally defined Lenis instance! This gives you more control and reduces bundle size if you're already using Lenis elsewhere.

### Option 1: Define Lenis globally (Recommended)

Before loading the shader script, initialize Lenis and make it globally available:

```html
<!-- Include Lenis from CDN or upload as asset -->
<script src="https://cdn.jsdelivr.net/npm/lenis@1.0.45/dist/lenis.min.js"></script>

<script>
	// Initialize your Lenis instance with custom settings
	const lenis = new Lenis({
		duration: 1.2,
		easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
		smooth: true,
		// ... your other Lenis options
	});

	// Make it available globally for the shader script
	window.lenis = lenis;

	// Start Lenis
	function raf(time) {
		lenis.raf(time);
		requestAnimationFrame(raf);
	}
	requestAnimationFrame(raf);
</script>

<!-- Now load your shader script -->
<script src="YOUR_SHADER_ASSET_URL_HERE"></script>
```

### Option 2: Use different global variable names

The shader script automatically detects Lenis from these locations:

-   `window.lenis`
-   `window.Lenis.instance`
-   `lenis` (direct global variable)

### Fallback Behavior

If no external Lenis instance is found, the shader script will automatically fall back to basic scroll tracking without smooth scrolling. You'll see a console warning when this happens.

### Benefits of External Lenis

1. **Smaller bundle**: Removes Lenis from the shader script bundle
2. **Better control**: Configure Lenis exactly how you want it
3. **Shared instance**: Use the same Lenis for other scroll-based animations
4. **Modular approach**: Keep concerns separated

## Troubleshooting

### Error: "Cannot read properties of null (reading 'width')"

This error occurs when the required HTML elements are missing. Make sure you have:

-   At least one element with the `data-webgl-media="true"` attribute

The canvas will be automatically created and positioned. The script will show helpful console warnings if required elements are missing.

### CORS/WebGL Texture Errors

If you see errors like "SecurityError: Failed to execute 'texSubImage2D'" or "contains cross-origin data", this is a CORS issue with images. The updated script includes:

-   **Automatic CORS handling**: Tries to load images with `crossOrigin="anonymous"`
-   **Fallback mechanism**: If CORS fails, falls back to the original image
-   **WebGL-safe texture settings**: Prevents mipmap generation errors
-   **Console warnings**: Helpful messages when CORS loading fails

**To minimize CORS issues:**

1. Host images on the same domain as your Webflow site
2. Use CDNs that support CORS (like Webflow's own image service)
3. Avoid hotlinking images from external domains without CORS headers

### Important Notes

-   The script includes DOM ready checks and will only initialize when all required elements are present
-   All dependencies (Three.js, GSAP, Lenis) are bundled into the single file
-   The file size is around 558KB minified - consider this for page load performance
-   The script uses a Webflow-safe version that handles DOM loading properly

### Re-building

Whenever you make changes to your shader or JavaScript code, run `npm run build:webflow` again to generate a new version of the file for Webflow.

## File Structure Expected by the Script

The script expects HTML elements that match the selectors used in `js/script.js`. Review your script to understand what classes and IDs it's looking for, and ensure your Webflow elements have the same structure.
