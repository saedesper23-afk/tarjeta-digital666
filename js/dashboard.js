// Dashboard Handler for DonniDeli
// This file handles purchase management and dashboard functionality

let currentEditingPurchaseId = null;

/**
 * Initialize the dashboard
 */
async function initDashboard() {
    await loadUserBarcode();
    await loadPurchases();
    setupEventListeners();
}

/**
 * Load and display user's barcode
 */
async function loadUserBarcode() {
    try {
        const user = await getCurrentUser();
        if (!user) return;

        const { data: barcodeData, error } = await window.supabaseClient
            .from('user_barcodes')
            .select('barcode')
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error('Error loading barcode:', error);
            return;
        }

        if (barcodeData && barcodeData.barcode) {
            displayBarcode(barcodeData.barcode);
        }
    } catch (error) {
        console.error('Unexpected error loading barcode:', error);
    }
}

/**
 * Display barcode in the dashboard
 * @param {string} barcode - User's unique barcode
 */
function displayBarcode(barcode) {
    const barcodeContainer = document.getElementById('barcodeContainer');
    if (barcodeContainer) {
        barcodeContainer.style.display = 'block';
        document.getElementById('userBarcode').textContent = barcode;
        
        // Generate visual barcode using JsBarcode
        try {
            JsBarcode("#barcodeImage", barcode, {
                format: "CODE128",
                width: 2,
                height: 80,
                displayValue: false,
                margin: 10,
                background: "#ffffff"
            });
        } catch (error) {
            console.error('Error generating barcode image:', error);
        }
    }
}
/**
 * Create initial visits for a user if they don't have any purchases
 * @param {string} userId - User's ID
 * @returns {Promise<boolean>} True if initial visits were created
 */
async function createInitialVisits(userId) {
    try {
        const initialVisits = [
            {
                user_id: userId,
                amount: 100.00,
                notes: '¡Las primeras dos van por nuestra cuenta!',
                purchase_date: new Date().toISOString(),
                added_by_admin_id: null,
                added_by_admin_email: 'Sistema'
            },
            {
                user_id: userId,
                amount: 100.00,
                notes: '¡Las primeras dos van por nuestra cuenta!',
                purchase_date: new Date().toISOString(),
                added_by_admin_id: null,
                added_by_admin_email: 'Sistema'
            }
        ];

        const { error } = await window.supabaseClient
            .from('purchases')
            .insert(initialVisits);

        if (error) {
            console.error('Error creating initial visits:', error);
            return false;
        }

        console.log('Initial visits created successfully');
        return true;
    } catch (error) {
        console.error('Unexpected error creating initial visits:', error);
        return false;
    }
}

/**
 * Setup event listeners for dashboard interactions
 */
function setupEventListeners() {
    const addPurchaseBtn = document.getElementById('addPurchaseBtn');
    const purchaseModal = document.getElementById('purchaseModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const purchaseForm = document.getElementById('purchaseForm');

    // Open modal to add new purchase
    if (addPurchaseBtn) {
        addPurchaseBtn.addEventListener('click', () => {
            currentEditingPurchaseId = null;
            document.getElementById('modalTitle').textContent = 'Add Purchase';
            document.getElementById('saveBtnText').textContent = 'Save Purchase';
            purchaseForm.reset();
            purchaseModal.classList.add('show');
        });
    }

    // Close modal
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            purchaseModal.classList.remove('show');
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            purchaseModal.classList.remove('show');
        });
    }

    // Close modal when clicking outside
    if (purchaseModal) {
        purchaseModal.addEventListener('click', (e) => {
            if (e.target === purchaseModal) {
                purchaseModal.classList.remove('show');
            }
        });
    }

    // Handle form submission
    if (purchaseForm) {
        purchaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await savePurchase();
        });
    }
}
/**
 * Load all purchases for the current user
 */
async function loadPurchases() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }

        const { data: purchases, error } = await window.supabaseClient
            .from('purchases')
            .select('*')
            .eq('user_id', user.id)
            .order('purchase_date', { ascending: false });

        if (error) {
            console.error('Error loading purchases:', error);
            showAlert('Failed to load purchases. Please refresh the page.', 'error');
            return;
        }

        // If user has no purchases, create the two initial visits automatically
        if (!purchases || purchases.length === 0) {
            console.log('No purchases found. Creating initial visits...');
            const created = await createInitialVisits(user.id);
            
            if (created) {
                // Reload purchases after creating initial visits
                const { data: newPurchases, error: reloadError } = await window.supabaseClient
                    .from('purchases')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('purchase_date', { ascending: false });

                if (!reloadError && newPurchases) {
                    displayPurchases(newPurchases);
                    updateStatistics(newPurchases);
                    return;
                }
            }
        }

        displayPurchases(purchases || []);
        updateStatistics(purchases || []);
    } catch (error) {
        console.error('Unexpected error loading purchases:', error);
        showAlert('An unexpected error occurred while loading purchases.', 'error');
    }
}

/**
 * Display purchases in the list
 * @param {Array} purchases - Array of purchase objects
 */
function displayPurchases(purchases) {
    const purchasesList = document.getElementById('purchasesList');
    const emptyState = document.getElementById('emptyState');

    if (!purchases || purchases.length === 0) {
        purchasesList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    purchasesList.innerHTML = purchases.map(purchase => `
        <div class="purchase-item" data-id="${purchase.id}">
            <div class="purchase-info">
                <div class="purchase-amount">$${parseFloat(purchase.amount).toFixed(2)}</div>
                <div class="purchase-date">${formatDate(purchase.purchase_date)}</div>
                ${purchase.notes ? `<div class="purchase-notes">${escapeHtml(purchase.notes)}</div>` : ''}
            </div>
            <div class="purchase-actions">
                <button class="btn-icon edit-purchase" data-id="${purchase.id}" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                        <path d="m15 5 4 4"/>
                    </svg>
                </button>
                <button class="btn-icon delete-purchase delete" data-id="${purchase.id}" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                        <line x1="10" x2="10" y1="11" y2="17"/>
                        <line x1="14" x2="14" y1="11" y2="17"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');

    // Add event listeners to edit and delete buttons
    document.querySelectorAll('.edit-purchase').forEach(btn => {
        btn.addEventListener('click', () => editPurchase(btn.dataset.id));
    });

    document.querySelectorAll('.delete-purchase').forEach(btn => {
        btn.addEventListener('click', () => deletePurchase(btn.dataset.id));
    });
}

/**
 * Update dashboard statistics
 * @param {Array} purchases - Array of purchase objects
 */
function updateStatistics(purchases) {
    const totalPurchases = purchases.length;
    const totalSpent = purchases.reduce((sum, purchase) => sum + parseFloat(purchase.amount), 0);
    const averageSpent = totalPurchases > 0 ? totalSpent / totalPurchases : 0;

    document.getElementById('totalPurchases').textContent = totalPurchases;
    document.getElementById('averageSpent').textContent = `$${averageSpent.toFixed(2)}`;
}

/**
 * Save a new or updated purchase
 */
async function savePurchase() {
    const amount = document.getElementById('amount').value;
    const notes = document.getElementById('notes').value.trim();
    const savePurchaseBtn = document.getElementById('savePurchaseBtn');
    const saveBtnText = document.getElementById('saveBtnText');
    const saveBtnSpinner = document.getElementById('saveBtnSpinner');

    // Disable button and show loading
    savePurchaseBtn.disabled = true;
    saveBtnText.style.display = 'none';
    saveBtnSpinner.style.display = 'inline-block';

    try {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }

        const purchaseData = {
            user_id: user.id,
            amount: parseFloat(amount),
            notes: notes || null,
            purchase_date: new Date().toISOString()
        };

        let error;

        if (currentEditingPurchaseId) {
            // Update existing purchase
            const result = await window.supabaseClient
                .from('purchases')
                .update(purchaseData)
                .eq('id', currentEditingPurchaseId)
                .eq('user_id', user.id);
            error = result.error;
        } else {
            // Insert new purchase
            const result = await window.supabaseClient
                .from('purchases')
                .insert([purchaseData]);
            error = result.error;
        }

        if (error) {
            console.error('Error saving purchase:', error);
            showAlert('Failed to save purchase. Please try again.', 'error');
            return;
        }

        // Close modal and reload purchases
        document.getElementById('purchaseModal').classList.remove('show');
        showAlert(
            currentEditingPurchaseId ? 'Purchase updated successfully!' : 'Purchase added successfully!',
            'success'
        );
        await loadPurchases();
    } catch (error) {
        console.error('Unexpected error saving purchase:', error);
        showAlert('An unexpected error occurred while saving purchase.', 'error');
    } finally {
        savePurchaseBtn.disabled = false;
        saveBtnText.style.display = 'inline';
        saveBtnSpinner.style.display = 'none';
    }
}

/**
 * Edit an existing purchase
 * @param {string} purchaseId - ID of the purchase to edit
 */
async function editPurchase(purchaseId) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }

        const { data: purchase, error } = await window.supabaseClient
            .from('purchases')
            .select('*')
            .eq('id', purchaseId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error('Error loading purchase:', error);
            showAlert('Failed to load purchase. Please try again.', 'error');
            return;
        }

        // Populate form with purchase data
        currentEditingPurchaseId = purchaseId;
        document.getElementById('modalTitle').textContent = 'Edit Purchase';
        document.getElementById('saveBtnText').textContent = 'Update Purchase';
        document.getElementById('amount').value = purchase.amount;
        document.getElementById('notes').value = purchase.notes || '';
        document.getElementById('purchaseModal').classList.add('show');
    } catch (error) {
        console.error('Unexpected error editing purchase:', error);
        showAlert('An unexpected error occurred while loading purchase.', 'error');
    }
}

/**
 * Delete a purchase
 * @param {string} purchaseId - ID of the purchase to delete
 */
async function deletePurchase(purchaseId) {
    if (!confirm('Are you sure you want to delete this purchase? This action cannot be undone.')) {
        return;
    }

    try {
        const user = await getCurrentUser();
        if (!user) {
            window.location.href = 'signin.html';
            return;
        }

        const { error } = await window.supabaseClient
            .from('purchases')
            .delete()
            .eq('id', purchaseId)
            .eq('user_id', user.id);

        if (error) {
            console.error('Error deleting purchase:', error);
            showAlert('Failed to delete purchase. Please try again.', 'error');
            return;
        }

        showAlert('Purchase deleted successfully!', 'success');
        await loadPurchases();
    } catch (error) {
        console.error('Unexpected error deleting purchase:', error);
        showAlert('An unexpected error occurred while deleting purchase.', 'error');
    }
}

/**
 * Show an alert message
 * @param {string} message - Message to display
 * @param {string} type - Type of alert (success, error, info)
 */
function showAlert(message, type = 'info') {
    const alertMessage = document.getElementById('alertMessage');
    alertMessage.textContent = message;
    alertMessage.className = `alert alert-${type} show`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertMessage.classList.remove('show');
    }, 5000);
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Export functions for use in other scripts
if (typeof window !== 'undefined') {
    window.dashboardFunctions = {
        initDashboard,
        loadPurchases,
        createInitialVisits,
        savePurchase,
        editPurchase,
        deletePurchase,
        showAlert
    };
}