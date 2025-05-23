// Background script for Stitch Auto Image Uploader
console.log('Stitch Auto Image Uploader - Background script loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
	console.log('Extension installed/updated:', details.reason);

	if (details.reason === 'install') {
		// Show welcome notification or open options page
		console.log('First time installation');
	}
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	console.log('Message received in background:', request);

	if (request.action === 'uploadComplete') {
		// Handle upload completion
		console.log('Upload completed:', request.success);
		sendResponse({ status: 'acknowledged' });
	}

	if (request.action === 'getImageUrl') {
		// Provide the URL for the bundled image
		const imageUrl = chrome.runtime.getURL('test-image.png');
		sendResponse({ imageUrl: imageUrl });
	}

	return true; // Will respond asynchronously
});

// Handle tab updates to check if user is on stitch.withgoogle.com
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (
		changeInfo.status === 'complete' &&
		tab.url &&
		tab.url.includes('stitch.withgoogle.com')
	) {
		console.log('User navigated to Stitch website');
		// Could inject content script here if needed
	}
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
	// This won't fire if popup is defined, but keeping for reference
	console.log('Extension icon clicked on tab:', tab.url);
});
