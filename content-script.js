// Stitch Auto Image Uploader - Content script loaded

// Check if we're in the parent frame or iframe
const isParentFrame = window.location.href.includes('stitch.withgoogle.com');
const isIframe = window.location.href.includes(
	'app-companion-430619.appspot.com'
);

// Variable to store the file input once found
let cachedFileInput = null;
let fileInputObserver = null;
let isInitialized = false;
let pasteListenerAdded = false;

// Wait for the page to be fully loaded
function waitForElement(selector, timeout = 10000) {
	return new Promise((resolve, reject) => {
		const element = document.querySelector(selector);
		if (element) {
			resolve(element);
			return;
		}

		const observer = new MutationObserver((mutations, obs) => {
			const element = document.querySelector(selector);
			if (element) {
				obs.disconnect();
				resolve(element);
			}
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});

		setTimeout(() => {
			observer.disconnect();
			reject(new Error(`Element ${selector} not found within ${timeout}ms`));
		}, timeout);
	});
}

// Function to create a file from pasted image data
async function createFileFromPastedImage(file) {
	try {
		// Validate it's an image
		if (!file.type.startsWith('image/')) {
			throw new Error('Pasted file is not an image');
		}

		// Create a proper File object with metadata
		const processedFile = new File([file], file.name || 'pasted-image.png', {
			type: file.type || 'image/png',
			lastModified: Date.now(),
		});

		return processedFile;
	} catch (error) {
		throw error;
	}
}

// Function to find the file input element with multiple strategies
function findFileInput() {
	// Strategy 1: Look for file input with image accept attributes
	const fileInputs = document.querySelectorAll('input[type="file"]');

	for (const input of fileInputs) {
		const accept = input.getAttribute('accept');
		if (accept && accept.includes('image')) {
			cachedFileInput = input;
			return input;
		}
	}

	// Strategy 2: Look for any file input (if accept attribute is missing)
	if (fileInputs.length > 0) {
		cachedFileInput = fileInputs[0];
		return fileInputs[0];
	}

	// Strategy 3: Look for file input by common class names or data attributes
	const possibleSelectors = [
		'input[accept*="image"]',
		'input[accept*="png"]',
		'input[accept*="jpg"]',
		'input[accept*="jpeg"]',
		'[data-testid*="upload"]',
		'[data-testid*="file"]',
		'.file-input',
		'.upload-input',
	];

	for (const selector of possibleSelectors) {
		const element = document.querySelector(selector);
		if (element && element.type === 'file') {
			cachedFileInput = element;
			return element;
		}
	}

	return null;
}

// Function to observe DOM for file input appearance
function observeFileInput() {
	if (fileInputObserver) {
		fileInputObserver.disconnect();
	}

	fileInputObserver = new MutationObserver((mutations) => {
		const fileInput = findFileInput();
		if (fileInput) {
			// File input detected
		}
	});

	fileInputObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});
}

// Function to wait for file input to appear with extended attempts
async function waitForFileInput(maxAttempts = 20, delay = 1000) {
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		// Check if we have a cached input and if it's still in the DOM
		if (cachedFileInput && document.body.contains(cachedFileInput)) {
			return cachedFileInput;
		}

		const fileInput = findFileInput();
		if (fileInput) {
			return fileInput;
		}

		if (attempt < maxAttempts) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	// Fallback: Try to trigger an upload modal by clicking a potential upload button
	const uploadButtonSelectors = [
		'[data-testid*="upload"]',
		'[aria-label*="upload"]',
		'[aria-label*="file"]',
		'[class*="upload"]',
		'[class*="file-upload"]',
		'[id*="upload"]',
		'button',
	];

	for (const selector of uploadButtonSelectors) {
		const buttons = document.querySelectorAll(selector);
		for (const button of buttons) {
			if (
				button.textContent.toLowerCase().includes('upload') ||
				button.textContent.toLowerCase().includes('file')
			) {
				button.click();
				// Wait a bit after click to see if input appears
				await new Promise((resolve) => setTimeout(resolve, 2000));
				const fileInputAfterClick = findFileInput();
				if (fileInputAfterClick) {
					return fileInputAfterClick;
				}
			}
		}
	}

	throw new Error(
		'File input not found after maximum attempts and fallback trigger'
	);
}

// Function to simulate file upload with pasted image
async function uploadPastedImage(pastedFile) {
	try {
		// Wait for the file input to appear with extended attempts
		const fileInput = await waitForFileInput(20, 1000);

		// Process the pasted file
		const file = await createFileFromPastedImage(pastedFile);

		// Create a DataTransfer object and add the file
		const dataTransfer = new DataTransfer();
		dataTransfer.items.add(file);

		// Set the files property
		fileInput.files = dataTransfer.files;

		// Trigger events to notify the framework
		const events = ['input', 'change'];

		events.forEach((eventType) => {
			const event = new Event(eventType, {
				bubbles: true,
				cancelable: true,
			});
			fileInput.dispatchEvent(event);
		});

		// Also try triggering a more specific file change event
		const changeEvent = new Event('change', {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperty(changeEvent, 'target', {
			writable: false,
			value: fileInput,
		});
		fileInput.dispatchEvent(changeEvent);

		// For React apps, also trigger focus and blur events
		fileInput.focus();
		fileInput.blur();

		// Try triggering on the parent elements as well (for some frameworks)
		let parent = fileInput.parentElement;
		while (parent && parent !== document.body) {
			const parentChangeEvent = new Event('change', {
				bubbles: true,
				cancelable: true,
			});
			parent.dispatchEvent(parentChangeEvent);
			parent = parent.parentElement;
		}
	} catch (error) {
		// Silent error handling
	}
}

// Function to show notification
function showNotification(message, type = 'info') {
	// Remove existing notifications
	const existingNotification = document.getElementById(
		'stitch-uploader-notification'
	);
	if (existingNotification) {
		existingNotification.remove();
	}

	// Create notification element
	const notification = document.createElement('div');
	notification.id = 'stitch-uploader-notification';
	notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    ${type === 'success' ? 'background-color: #10b981;' : ''}
    ${type === 'error' ? 'background-color: #ef4444;' : ''}
    ${type === 'info' ? 'background-color: #3b82f6;' : ''}
  `;

	notification.textContent = message;
	document.body.appendChild(notification);

	// Auto remove after 3 seconds
	setTimeout(() => {
		if (notification.parentNode) {
			notification.style.opacity = '0';
			notification.style.transform = 'translateX(100%)';
			setTimeout(() => notification.remove(), 300);
		}
	}, 3000);
}

// Function to setup paste detection on text input
function setupPasteDetection() {
	if (pasteListenerAdded) {
		return;
	}

	// Find the text input area using the provided selector
	const textInputSelector = '.tiptap.ProseMirror[contenteditable="true"]';
	const textInput = document.querySelector(textInputSelector);

	if (textInput) {
		textInput.addEventListener('paste', async (event) => {
			// Get clipboard data
			const clipboardData = event.clipboardData || window.clipboardData;
			if (!clipboardData) {
				return;
			}

			// Check for image files in clipboard
			const files = Array.from(clipboardData.files);
			const imageFiles = files.filter((file) => file.type.startsWith('image/'));

			if (imageFiles.length > 0) {
				// Prevent default paste behavior for images
				event.preventDefault();

				// Upload the first image file
				const imageFile = imageFiles[0];
				try {
					await uploadPastedImage(imageFile);
				} catch (error) {
					// Silent error handling
				}
			}
		});

		pasteListenerAdded = true;
	}
}

// Function to observe for text input appearance
function observeTextInput() {
	const textInputSelector = '.tiptap.ProseMirror[contenteditable="true"]';

	const observer = new MutationObserver(() => {
		if (!pasteListenerAdded) {
			setupPasteDetection();
		}
	});

	observer.observe(document.body, {
		childList: true,
		subtree: true,
	});
}

// Listen for messages from parent frame or extension popup
function setupMessageListener() {
	window.addEventListener('message', (event) => {
		// Remove old upload request handling since we're using paste detection now
	});
}

// Initialize the extension
function initialize() {
	if (isInitialized) {
		return;
	}
	isInitialized = true;

	// Set up message listener immediately in iframe to catch early messages
	if (isIframe) {
		setupMessageListener();
	}

	// Wait a bit for the page to fully load
	setTimeout(() => {
		if (isParentFrame) {
			observeTextInput();
			setupPasteDetection();
			observeFileInput(); // Still need this for upload functionality
		} else if (isIframe) {
			setupMessageListener();
			observeFileInput(); // Start observing DOM for file input
			setTimeout(() => {
				findFileInput();
			}, 2000);
		}

		// Set up a periodic check for file input if not found initially (in both contexts as fallback)
		let attempts = 0;
		const maxAttempts = 30;
		const interval = setInterval(() => {
			attempts++;
			const fileInput = findFileInput();
			if (fileInput) {
				clearInterval(interval);
			}

			// Also check for text input in parent frame
			if (isParentFrame && !pasteListenerAdded) {
				setupPasteDetection();
			}

			if (attempts >= maxAttempts) {
				clearInterval(interval);
			}
		}, 2000);
	}, 2000);
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initialize);
} else {
	initialize();
}
// Also initialize immediately in case DOM is already loaded
initialize();
