// Admin Handler for DonniDeli
// This file handles admin-specific operations

let currentClientUserId = null;
let currentClientEmail = null;

/**
 * Check if the current user is an admin
 * @returns {Promise<boolean>}
 */
async function checkIfAdmin() {
    try {
        const user = await getCurrentUser();
        if (!user) return false;

        const { data, error } = await window.supabaseClient
            .from('admins')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.log('User is not an admin');
            return false;
        }

        return !!data;
    } catch (error) {
        console.error('Error checking admin status:', error);
        return false;
    }
}

/**
 * Initialize the admin dashboard
 */
function initAdminDashboard() {
    setupAdminEventListeners();
}

/**
 * Setup event listeners for admin dashboard
 */
function setupAdminEventListeners() {
    const clientLookupForm = document.getElementById('clientLookupForm');
    const addPurchaseBtn = document.getElementById('addPurchaseBtn');
    const resetHistoryBtn = document.getElementById('resetHistoryBtn');
    const purchaseModal = document.getElementById('purchaseModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const purchaseForm = document.getElementById('purchaseForm');

    // Client lookup
    clientLookupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await lookupClient();
    });

    // Add purchase for client
    addPurchaseBtn.addEventListener('click', () => {
        document.getElementById('amount').value = '';
        document.getElementById('notes').value = '';
        purchaseModal.classList.add('show');
    });

    // Reset history
    resetHistoryBtn.addEventListener('click', async () => {
        await resetClientHistory();
    });

    // Close modal
    closeModal.addEventListener('click', () => {
        purchaseModal.classList.remove('show');
    });

    cancelBtn.addEventListener('click', () => {
        purchaseModal.classList.remove('show');
    });

    // Close modal when clicking outside
    purchaseModal.addEventListener('click', (e) => {
        if (e.target === purchaseModal) {
            purchaseModal.classList.remove('show');
        }
    });

    // Handle form submission
    purchaseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addPurchaseForClient();
    });
}

/**
 * Look up a client by email or barcode
 */
async function lookupClient() {
    const searchInput = document.getElementById('searchInput').value.trim();
    const lookupBtn = document.getElementById('lookupBtn');
    const lookupBtnText = document.getElementById('lookupBtnText');
    const lookupBtnSpinner = document.getElementById('lookupBtnSpinner');
    const alertMessage = document.getElementById('alertMessage');

    // Clear previous alerts
    alertMessage.classList.remove('show', 'alert-error', 'alert-success');

    // Disable button and show loading
    lookupBtn.disabled = true;
    lookupBtnText.style.display = 'none';
    lookupBtnSpinner.style.display = 'inline-block';

    try {
        let data, error;
        
        // Check if input looks like a barcode (starts with DN and has 12 characters)
        const isBarcodeFormat = /^DN\d{10}$/i.test(searchInput);
        
        if (isBarcodeFormat) {
            // Search by barcode
            const result = await window.supabaseClient
                .rpc('get_user_stats_by_barcode', { search_barcode: searchInput.toUpperCase() });
            data = result.data;
            error = result.error;
        } else {
            // Search by email
            const result = await window.supabaseClient
                .rpc('get_user_stats', { target_email: searchInput });
            data = result.data;
            error = result.error;
        }

        if (error) {
            console.error('Error looking up client:', error);
            showAlert('Error al buscar cliente. Por favor intenta de nuevo.', 'error');
            document.getElementById('clientInfo').style.display = 'none';
            return;
        }

        if (!data || data.length === 0) {
            showAlert('No se encontró ningún cliente con ese correo o código de barras.', 'error');
            document.getElementById('clientInfo').style.display = 'none';
            return;
        }

        const clientData = data[0];
        currentClientUserId = clientData.user_id;
        currentClientEmail = clientData.email;

        // Display client info
        document.getElementById('clientEmailDisplay').textContent = clientData.email;
        document.getElementById('clientBarcodeDisplay').textContent = clientData.barcode || 'N/A';
        document.getElementById('clientTotalPurchases').textContent = clientData.total_purchases;
        document.getElementById('clientTotalSpent').textContent = `$${parseFloat(clientData.total_spent).toFixed(2)}`;
        document.getElementById('clientAverageSpent').textContent = `$${parseFloat(clientData.average_spent).toFixed(2)}`;

        // Show/hide reset button based on purchase count
        const resetBtn = document.getElementById('resetHistoryBtn');
        if (clientData.total_purchases >= 10) {
            resetBtn.style.display = 'inline-flex';
        } else {
            resetBtn.style.display = 'none';
        }

        // Show client info section
        document.getElementById('clientInfo').style.display = 'block';

        // Load client purchases
        await loadClientPurchases(currentClientUserId);

        showAlert('¡Cliente encontrado exitosamente!', 'success');
    } catch (error) {
        console.error('Unexpected error looking up client:', error);
        showAlert('Ocurrió un error inesperado. Por favor intenta de nuevo.', 'error');
        document.getElementById('clientInfo').style.display = 'none';
    } finally {
        lookupBtn.disabled = false;
        lookupBtnText.style.display = 'inline';
        lookupBtnSpinner.style.display = 'none';
    }
}

/**
 * Load purchases for a specific client
 * @param {string} userId - Client's user ID
 */
async function loadClientPurchases(userId) {
    try {
        const { data: purchases, error } = await window.supabaseClient
            .from('purchases')
            .select('*')
            .eq('user_id', userId)
            .order('purchase_date', { ascending: false });

        if (error) {
            console.error('Error loading client purchases:', error);
            showAlert('Error al cargar las compras del cliente.', 'error');
            return;
        }

        console.log('Purchases loaded:', purchases); // Debug

        displayClientPurchases(purchases || []);
    } catch (error) {
        console.error('Unexpected error loading client purchases:', error);
        showAlert('Ocurrió un error inesperado al cargar las compras.', 'error');
    }
}

/**
 * Display client purchases
 * @param {Array} purchases - Array of purchase objects
 */
function displayClientPurchases(purchases) {
    const purchasesList = document.getElementById('clientPurchasesList');
    const emptyState = document.getElementById('clientEmptyState');

    if (!purchases || purchases.length === 0) {
        purchasesList.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    purchasesList.innerHTML = purchases.map(purchase => {
        const adminEmail = purchase.added_by_admin_email || 'Sistema';
        return `
        <div class="purchase-item" data-id="${purchase.id}">
            <div class="purchase-info">
                <div class="purchase-amount">$${parseFloat(purchase.amount).toFixed(2)}</div>
                <div class="purchase-date">${formatDate(purchase.purchase_date)}</div>
                ${purchase.notes ? `<div class="purchase-notes">${escapeHtml(purchase.notes)}</div>` : ''}
                <div style="color: var(--text-light); font-size: 0.875rem; margin-top: 0.25rem;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block; vertical-align: middle; margin-right: 0.25rem;">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    Registrado por: ${escapeHtml(adminEmail)}
                </div>
            </div>
            <div class="purchase-actions">
                <button class="btn-icon delete-purchase delete" data-id="${purchase.id}" title="Eliminar">
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
    `;
    }).join('');

    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-purchase').forEach(btn => {
        btn.addEventListener('click', () => deleteClientPurchase(btn.dataset.id));
    });
}

/**
 * Add a purchase for the current client
 */
async function addPurchaseForClient() {
    if (!currentClientUserId) {
        showAlert('Por favor selecciona un cliente primero.', 'error');
        return;
    }

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
        // Get current admin user
        const adminUser = await getCurrentUser();
        
        const purchaseData = {
            user_id: currentClientUserId,
            amount: parseFloat(amount),
            notes: notes || null,
            purchase_date: new Date().toISOString(),
            added_by_admin_id: adminUser.id,  // Track which admin added this purchase
            added_by_admin_email: adminUser.email  // Store admin email directly
        };

        const { error } = await window.supabaseClient
            .from('purchases')
            .insert([purchaseData]);

        if (error) {
            console.error('Error adding purchase:', error);
            showAlert('Error al agregar la compra. Por favor intenta de nuevo.', 'error');
            return;
        }

        // Close modal and reload client data
        document.getElementById('purchaseModal').classList.remove('show');
        showAlert('¡Compra agregada exitosamente!', 'success');
        
        // Refresh client data
        document.getElementById('searchInput').value = currentClientEmail;
        await lookupClient();
    } catch (error) {
        console.error('Unexpected error adding purchase:', error);
        showAlert('Ocurrió un error inesperado al agregar la compra.', 'error');
    } finally {
        savePurchaseBtn.disabled = false;
        saveBtnText.style.display = 'inline';
        saveBtnSpinner.style.display = 'none';
    }
}

/**
 * Delete a client purchase
 * @param {string} purchaseId - ID of the purchase to delete
 */
async function deleteClientPurchase(purchaseId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta compra? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('purchases')
            .delete()
            .eq('id', purchaseId);

        if (error) {
            console.error('Error deleting purchase:', error);
            showAlert('Error al eliminar la compra. Por favor intenta de nuevo.', 'error');
            return;
        }

        showAlert('¡Compra eliminada exitosamente!', 'success');
        
        // Refresh client data
        document.getElementById('searchInput').value = currentClientEmail;
        await lookupClient();
    } catch (error) {
        console.error('Unexpected error deleting purchase:', error);
        showAlert('Ocurrió un error inesperado al eliminar la compra.', 'error');
    }
}

/**
 * Reset client purchase history (for clients with 10+ purchases)
 */
async function resetClientHistory() {
    if (!currentClientUserId) {
        showAlert('Por favor selecciona un cliente primero.', 'error');
        return;
    }

    const confirmMessage = `¿Estás seguro de que quieres reiniciar el historial de compras de ${currentClientEmail}?\n\nEsto ELIMINARÁ TODAS las compras de este cliente. Esta acción no se puede deshacer.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }

    // Double confirmation
    if (!confirm('Esta es tu confirmación final. ¿Estás absolutamente seguro?')) {
        return;
    }

    try {
        const { error } = await window.supabaseClient
            .from('purchases')
            .delete()
            .eq('user_id', currentClientUserId);

        if (error) {
            console.error('Error resetting history:', error);
            showAlert('Error al reiniciar el historial. Por favor intenta de nuevo.', 'error');
            return;
        }

        showAlert('¡Historial reiniciado exitosamente!', 'success');
        
        // Refresh client data
        document.getElementById('searchInput').value = currentClientEmail;
        await lookupClient();
    } catch (error) {
        console.error('Unexpected error resetting history:', error);
        showAlert('Ocurrió un error inesperado al reiniciar el historial.', 'error');
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
    return date.toLocaleDateString('es-MX', options);
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
    window.adminFunctions = {
        checkIfAdmin,
        initAdminDashboard,
        lookupClient,
        addPurchaseForClient,
        resetClientHistory
    };
}