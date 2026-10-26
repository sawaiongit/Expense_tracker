
// ============================================================
// PENNYWISE — PERSONAL EXPENSE TRACKER
// File: script.js
// Technologies: HTML, CSS, Vanilla JavaScript
// ============================================================

"use strict";

// ============================================================
// 1. CONFIGURATION & HELPERS
// ============================================================

const PennyWise = (() => {
    const STORAGE_KEY = "pennywise_data_v1";

    const CATEGORIES = {
        expense: [
            "Food & Groceries",
            "Travel & Transport",
            "Education",
            "Hostel & Rent",
            "Shopping",
            "Entertainment",
            "Health",
            "Bills & Utilities",
            "Personal Care",
            "Other"
        ],
        income: [
            "Pocket Money",
            "Salary",
            "Freelancing",
            "Scholarship",
            "Part-time Job",
            "Business",
            "Gift",
            "Interest",
            "Other Income"
        ]
    };

    const CATEGORY_ICONS = {
        "Food & Groceries": "utensils",
        "Travel & Transport": "bus",
        "Education": "book-open",
        "Hostel & Rent": "house",
        "Shopping": "shopping-bag",
        "Entertainment": "gamepad-2",
        "Health": "heart-pulse",
        "Bills & Utilities": "receipt",
        "Personal Care": "sparkles",
        "Pocket Money": "wallet",
        "Salary": "briefcase-business",
        "Freelancing": "laptop",
        "Scholarship": "graduation-cap",
        "Part-time Job": "clock",
        "Business": "building-2",
        "Gift": "gift",
        "Interest": "trending-up",
        "Other": "circle-dollar-sign",
        "Other Income": "circle-dollar-sign"
    };

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const get = (id) => document.getElementById(id);

    const makeId = () =>
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const today = () => {
        const date = new Date();
        const offset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - offset)
            .toISOString()
            .slice(0, 10);
    };

    const currentMonth = () => today().slice(0, 7);

    const number = (value) => {
        const result = Number(value);
        return Number.isFinite(result) ? result : 0;
    };

    const money = (amount) => {
        const value = number(amount);
        const currency = state.settings.currency || "INR";

        try {
            return new Intl.NumberFormat("en-IN", {
                style: "currency",
                currency,
                maximumFractionDigits: 2
            }).format(value);
        } catch {
            return `₹${value.toFixed(2)}`;
        }
    };

    const escapeHTML = (value) =>
        String(value ?? "").replace(/[&<>"']/g, (character) => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]);

    const formatDate = (value) => {
        if (!value) return "—";

        const date = new Date(`${value}T00:00:00`);

        if (Number.isNaN(date.getTime())) return "—";

        return date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    };

    const formatMonth = (month) => {
        if (!month) return "";

        const date = new Date(`${month}-01T00:00:00`);

        return Number.isNaN(date.getTime())
            ? month
            : date.toLocaleDateString("en-IN", {
                month: "long",
                year: "numeric"
            });
    };

    const isValidAmount = (value) =>
        Number.isFinite(Number(value)) && Number(value) > 0;

    // ========================================================
    // 2. DEFAULT APPLICATION DATA
    // ========================================================

    const defaultState = () => ({
        version: 1,

        profile: {
            name: "",
            type: "student",
            initialized: false,
            startingIncome: 0,
            startingIncomeLabel: "Pocket Money",
            startingIncomeDate: today(),
            openingBalance: 0,
            notes: ""
        },

        settings: {
            currency: "INR",
            monthlyBudget: 0,
            monthStart: 1
        },

        transactions: [],

        budgets: [],

        goals: [],

        preferences: {
            selectedMonth: currentMonth(),
            transactionFilter: "all",
            categoryFilter: "all",
            searchQuery: ""
        }
    });

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) return defaultState();

            const saved = JSON.parse(raw);
            const defaults = defaultState();

            return {
                ...defaults,
                ...saved,

                profile: {
                    ...defaults.profile,
                    ...(saved.profile || {})
                },

                settings: {
                    ...defaults.settings,
                    ...(saved.settings || {})
                },

                preferences: {
                    ...defaults.preferences,
                    ...(saved.preferences || {})
                },

                transactions: Array.isArray(saved.transactions)
                    ? saved.transactions
                    : [],

                budgets: Array.isArray(saved.budgets)
                    ? saved.budgets
                    : [],

                goals: Array.isArray(saved.goals)
                    ? saved.goals
                    : []
            };
        } catch (error) {
            console.error("Unable to load PennyWise data:", error);
            return defaultState();
        }
    }

    let state = loadState();

    let editingTransactionId = null;
    let editingGoalId = null;
    let editingBudgetId = null;
    let toastTimeout = null;
    let pendingConfirmation = null;

    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (error) {
            console.error("Unable to save PennyWise data:", error);
            showToast(
                "Unable to save data. Export a backup and check browser storage.",
                "error"
            );
            return false;
        }
    }

    // ========================================================
    // 3. FINANCIAL CALCULATIONS
    // ========================================================

    function transactionsForMonth(month = currentMonth()) {
        return state.transactions.filter(
            (transaction) => transaction.date?.startsWith(month)
        );
    }

    function calculateSummary(month = currentMonth()) {
        const transactions = transactionsForMonth(month);

        const monthlyIncome = transactions
            .filter((item) => item.type === "income")
            .reduce((total, item) => total + number(item.amount), 0);

        const monthlyExpenses = transactions
            .filter((item) => item.type === "expense")
            .reduce((total, item) => total + number(item.amount), 0);

        const allTimeIncome =
            number(state.profile.startingIncome) +
            state.transactions
                .filter((item) => item.type === "income")
                .reduce((total, item) => total + number(item.amount), 0);

        const allTimeExpenses = state.transactions
            .filter((item) => item.type === "expense")
            .reduce((total, item) => total + number(item.amount), 0);

        const balance =
            number(state.profile.openingBalance) +
            allTimeIncome -
            allTimeExpenses;

        // This is money remaining after expenses, not an additional
        // amount to add to the balance.
        const savings = Math.max(0, balance);

        const budget = number(state.settings.monthlyBudget);

        const budgetRemaining = budget - monthlyExpenses;

        const spendingPercentage = budget > 0
            ? (monthlyExpenses / budget) * 100
            : 0;

        const savingsRate = allTimeIncome > 0
            ? (savings / allTimeIncome) * 100
            : 0;

        return {
            month,
            monthlyIncome,
            monthlyExpenses,
            monthlyNet: monthlyIncome - monthlyExpenses,
            allTimeIncome,
            allTimeExpenses,
            balance,
            savings,
            budget,
            budgetRemaining,
            spendingPercentage,
            savingsRate
        };
    }

    function calculateCategoryTotals(month = currentMonth()) {
        const totals = {};

        transactionsForMonth(month)
            .filter((item) => item.type === "expense")
            .forEach((item) => {
                const category = item.category || "Other";
                totals[category] =
                    (totals[category] || 0) + number(item.amount);
            });

        return Object.entries(totals)
            .map(([category, amount]) => ({ category, amount }))
            .sort((a, b) => b.amount - a.amount);
    }

    // ========================================================
    // 4. NOTIFICATIONS
    // ========================================================

    function showToast(message, type = "success") {
        const container = get("toast-message");
        const text = get("toast-text");

        if (!container || !text) {
            console.log(`[PennyWise ${type}] ${message}`);
            return;
        }

        if (toastTimeout) clearTimeout(toastTimeout);

        text.textContent = message;

        container.classList.remove("success", "error", "warning");
        container.classList.add(type);

        container.hidden = false;

        toastTimeout = setTimeout(() => {
            container.hidden = true;
        }, 3500);
    }

    // ========================================================
    // 5. MODAL MANAGEMENT
    // ========================================================

    function openModal(modalId) {
        const modal = get(modalId);
        if (!modal) return;

        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");

        document.body.style.overflow = "hidden";

        const firstInput = $("input:not([type='hidden']), select, textarea", modal);

        if (firstInput) {
            setTimeout(() => firstInput.focus(), 50);
        }
    }

    function closeModal(modalId) {
        const modal = get(modalId);
        if (!modal) return;

        modal.hidden = true;
        modal.setAttribute("aria-hidden", "true");

        if (!$(".modal-overlay:not([hidden])")) {
            document.body.style.overflow = "";
        }
    }

    // ========================================================
    // 6. ACCOUNT SETUP: STUDENT OR PROFESSIONAL
    // ========================================================

    function selectedAccountType() {
        const student = get("student-option");
        const professional = get("professional-option");

        if (professional?.checked) return "professional";
        if (student?.checked) return "student";

        return state.profile.type || "student";
    }

    function updateAccountTypeUI() {
        const type = selectedAccountType();

        $$(".account-type-option").forEach((option) => {
            const input = $("input", option);
            option.classList.toggle(
                "selected",
                Boolean(input?.checked)
            );
        });

        const label = get("income-label");
        const incomeInput = get("income-amount");

        if (label) {
            label.textContent = type === "student"
                ? "Monthly Pocket Money (₹)"
                : "Monthly Salary / Income (₹)";
        }

        if (incomeInput) {
            incomeInput.placeholder = type === "student"
                ? "e.g. 5000"
                : "e.g. 25000";
        }

        const heading = get("account-setup-title");

        if (heading) {
            heading.textContent = type === "student"
                ? "Set Up Your Student Wallet"
                : "Set Up Your Personal Finances";
        }

        const description = get("account-setup-description");

        if (description) {
            description.textContent = type === "student"
                ? "Track your pocket money, college expenses and savings."
                : "Track your salary, daily expenses, budget and savings.";
        }
    }

    function setupAccount(event) {
        event.preventDefault();

        const incomeInput = get("income-amount");
        const budgetInput = get("budget-limit");
        const nameInput = get("user-name");

        const income = number(incomeInput?.value);
        const budget = number(budgetInput?.value);
        const type = selectedAccountType();

        if (!Number.isFinite(income) || income < 0) {
            showToast("Enter a valid income amount.", "error");
            incomeInput?.focus();
            return;
        }

        if (!Number.isFinite(budget) || budget < 0) {
            showToast("Enter a valid monthly budget.", "error");
            budgetInput?.focus();
            return;
        }

        state.profile.type = type;
        state.profile.name = nameInput?.value.trim() || "";
        state.profile.startingIncome = income;
        state.profile.startingIncomeLabel =
            type === "student" ? "Pocket Money" : "Salary / Income";
        state.profile.startingIncomeDate = today();
        state.profile.initialized = true;

        // Opening balance is kept separately, so initial income
        // isn't inserted as a duplicate income transaction.
        state.settings.monthlyBudget = budget;

        if (!saveState()) return;

        const setup = get("account-setup");

        if (setup) setup.hidden = true;

        renderAll();

        showToast(
            type === "student"
                ? "Student wallet set up successfully!"
                : "Personal finance account set up successfully!"
        );
    }

    function showAccountSetup() {
        const setup = get("account-setup");
        if (setup) setup.hidden = false;

        const student = get("student-option");
        const professional = get("professional-option");

        if (student) student.checked = state.profile.type !== "professional";
        if (professional) professional.checked = state.profile.type === "professional";

        const income = get("income-amount");
        const budget = get("budget-limit");
        const name = get("user-name");

        if (income) income.value = state.profile.startingIncome || "";
        if (budget) budget.value = state.settings.monthlyBudget || "";
        if (name) name.value = state.profile.name || "";

        updateAccountTypeUI();

        setup?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    // ========================================================
    // 7. DASHBOARD SUMMARY
    // ========================================================

    function setText(id, value) {
        const element = get(id);
        if (element) element.textContent = value;
    }

    function renderSummary() {
        const monthSelect = get("dashboard-month");
        const month = monthSelect?.value || currentMonth();
        const summary = calculateSummary(month);

        setText("total-income", money(summary.monthlyIncome));
        setText("total-expenses", money(summary.monthlyExpenses));
        setText("remaining-balance", money(summary.balance));
        setText("total-savings", money(summary.savings));

        setText("monthly-income-note",
            `Income recorded in ${formatMonth(month)}`);

        setText("monthly-expense-note",
            `Expenses recorded in ${formatMonth(month)}`);

        setText("balance-note",
            summary.balance < 0
                ? "Your recorded expenses exceed available funds."
                : "Current balance after all recorded expenses.");

        setText("savings-note",
            "Positive balance available after recorded expenses.");

        renderBudgetOverview(summary);
    }

    function renderBudgetOverview(summary = calculateSummary()) {
        const budget = summary.budget;
        const spent = summary.monthlyExpenses;

        const percentage = budget > 0
            ? Math.min((spent / budget) * 100, 100)
            : 0;

        setText("budget-percentage", `${Math.round(
            budget > 0 ? (spent / budget) * 100 : 0
        )}%`);

        setText("budget-spent", money(spent));
        setText("budget-total", money(budget));

        const progress = get("budget-progress");
        if (progress) {
            progress.style.width = `${percentage}%`;
            progress.classList.toggle("warning", percentage >= 75 && percentage < 100);
            progress.classList.toggle("danger", spent > budget && budget > 0);
        }

        const remaining = get("budget-remaining");

        if (remaining) {
            remaining.textContent = budget > 0
                ? spent > budget
                    ? `${money(spent - budget)} over budget`
                    : `${money(budget - spent)} remaining`
                : "Set a monthly budget to track your spending.";

            remaining.classList.toggle(
                "over-budget",
                budget > 0 && spent > budget
            );
        }
    }

    // ========================================================
    // 8. TRANSACTION FORM
    // ========================================================

    function updateCategoryOptions(type, selectedCategory = "") {
        const select = get("transaction-category");
        if (!select) return;

        const categories = CATEGORIES[type] || CATEGORIES.expense;

        select.innerHTML = [
            '<option value="">Select a category</option>',
            ...categories.map((category) =>
                `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
            )
        ].join("");

        if (selectedCategory) select.value = selectedCategory;
    }

    function setTransactionType(type) {
        const incomeRadio = get("transaction-income");
        const expenseRadio = get("transaction-expense");

        if (incomeRadio) incomeRadio.checked = type === "income";
        if (expenseRadio) expenseRadio.checked = type === "expense";

        $$(".transaction-type-option").forEach((option) => {
            const input = $("input", option);

            option.classList.toggle(
                "selected",
                input?.value === type && Boolean(input.checked)
            );
        });

        updateCategoryOptions(type);

        const title = get("transaction-modal-title");

        if (title && !editingTransactionId) {
            title.textContent = type === "income"
                ? "Add Income"
                : "Add Expense";
        }

        const amountLabel = get("transaction-amount-label");

        if (amountLabel) {
            amountLabel.textContent = type === "income"
                ? "Income Amount (₹)"
                : "Expense Amount (₹)";
        }
    }

    function openTransactionModal(type = "expense", transactionId = null) {
        const form = get("transaction-form");
        if (!form) {
            showToast("Transaction form not found in HTML.", "error");
            return;
        }

        editingTransactionId = transactionId;

        form.reset();

        const existing = transactionId
            ? state.transactions.find((item) => item.id === transactionId)
            : null;

        setTransactionType(existing?.type || type);

        if (existing) {
            setText("transaction-modal-title", "Edit Transaction");

            const fields = {
                "transaction-title": existing.title,
                "transaction-amount": existing.amount,
                "transaction-date": existing.date,
                "transaction-payment-method": existing.paymentMethod || "",
                "transaction-notes": existing.notes || ""
            };

            Object.entries(fields).forEach(([id, value]) => {
                const field = get(id);
                if (field) field.value = value;
            });

            updateCategoryOptions(existing.type, existing.category);
        } else {
            setText(
                "transaction-modal-title",
                type === "income" ? "Add Income" : "Add Expense"
            );

            const date = get("transaction-date");
            if (date) date.value = today();

            updateCategoryOptions(type);
        }

        openModal("transaction-modal");
    }

    function submitTransaction(event) {
        event.preventDefault();

        const type = get("transaction-income")?.checked
            ? "income"
            : "expense";

        const title = get("transaction-title")?.value.trim() || "";
        const amount = number(get("transaction-amount")?.value);
        const category = get("transaction-category")?.value || "";
        const date = get("transaction-date")?.value || "";
        const paymentMethod =
            get("transaction-payment-method")?.value || "";
        const notes = get("transaction-notes")?.value.trim() || "";

        if (!title) {
            showToast("Enter a transaction name.", "error");
            get("transaction-title")?.focus();
            return;
        }

        if (!isValidAmount(amount)) {
            showToast("Amount must be greater than zero.", "error");
            get("transaction-amount")?.focus();
            return;
        }

        if (!category) {
            showToast("Choose a transaction category.", "error");
            get("transaction-category")?.focus();
            return;
        }

        if (!date || date > today()) {
            showToast("Choose a valid transaction date.", "error");
            get("transaction-date")?.focus();
            return;
        }

        const transaction = {
            id: editingTransactionId || makeId(),
            type,
            title,
            amount,
            category,
            date,
            paymentMethod,
            notes,
            updatedAt: new Date().toISOString()
        };

        if (editingTransactionId) {
            const index = state.transactions.findIndex(
                (item) => item.id === editingTransactionId
            );

            if (index !== -1) {
                state.transactions[index] = {
                    ...state.transactions[index],
                    ...transaction
                };
            }
        } else {
            state.transactions.push({
                ...transaction,
                createdAt: new Date().toISOString()
            });
        }

        if (!saveState()) return;

        closeModal("transaction-modal");
        editingTransactionId = null;

        renderAll();

        showToast(
            type === "income"
                ? "Income saved successfully!"
                : "Expense saved successfully!"
        );
    }

    // ========================================================
    // 9. DELETE TRANSACTIONS
    // ========================================================

    function deleteTransaction(id) {
        const transaction = state.transactions.find(
            (item) => item.id === id
        );

        if (!transaction) return;

        askConfirmation(
            "Delete transaction?",
            `Delete "${transaction.title}" (${money(transaction.amount)})? This cannot be undone.`,
            () => {
                state.transactions = state.transactions.filter(
                    (item) => item.id !== id
                );

                if (!saveState()) return;

                renderAll();
                showToast("Transaction deleted.");
            }
        );
    }

    // ========================================================
    // 10. TRANSACTION TABLES & FILTERS
    // ========================================================

    function transactionRow(transaction) {
        const icon = CATEGORY_ICONS[transaction.category] || "receipt";
        const amountPrefix = transaction.type === "income" ? "+" : "−";
        const amountClass = transaction.type === "income" ? "income" : "expense";

        return `
            <tr>
                <td>
                    <div class="transaction-name-cell">
                        <span class="transaction-icon">
                            <i data-lucide="${icon}"></i>
                        </span>
                        <span class="transaction-name-content">
                            <strong>${escapeHTML(transaction.title)}</strong>
                            <small>${escapeHTML(transaction.paymentMethod || "Not specified")}</small>
                        </span>
                    </div>
                </td>
                <td>${escapeHTML(formatDate(transaction.date))}</td>
                <td>
                    <span class="category-badge">
                        ${escapeHTML(transaction.category)}
                    </span>
                </td>
                <td>
                    <span class="transaction-amount ${amountClass}">
                        ${amountPrefix}${escapeHTML(money(transaction.amount))}
                    </span>
                </td>
                <td>
                    <div class="transaction-actions">
                        <button type="button"
                            data-action="edit-transaction"
                            data-id="${escapeHTML(transaction.id)}"
                            aria-label="Edit ${escapeHTML(transaction.title)}"
                            title="Edit">
                            <i data-lucide="pencil"></i>
                        </button>
                        <button type="button"
                            class="delete-button"
                            data-action="delete-transaction"
                            data-id="${escapeHTML(transaction.id)}"
                            aria-label="Delete ${escapeHTML(transaction.title)}"
                            title="Delete">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    function emptyTableRow(message, columns = 5) {
        return `
            <tr>
                <td colspan="${columns}">
                    <div class="empty-state">
                        <div class="empty-state-icon">
                            <i data-lucide="receipt-text"></i>
                        </div>
                        <h3>No transactions found</h3>
                        <p>${escapeHTML(message)}</p>
                    </div>
                </td>
            </tr>
        `;
    }

    function filteredTransactions() {
        const filter = get("transaction-filter")?.value || "all";
        const category = get("category-filter")?.value || "all";
        const query = (
            get("transaction-search")?.value || ""
        ).trim().toLowerCase();

        return [...state.transactions]
            .filter((item) => filter === "all" || item.type === filter)
            .filter((item) => category === "all" || item.category === category)
            .filter((item) => {
                const text = [
                    item.title,
                    item.category,
                    item.paymentMethod,
                    item.notes
                ].join(" ").toLowerCase();

                return text.includes(query);
            })
            .sort((a, b) =>
                b.date.localeCompare(a.date) ||
                String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
            );
    }

    function renderTransactions() {
        const recentBody = get("transactions-list");
        const allBody = get("all-transactions-list");

        const recent = [...state.transactions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 5);

        if (recentBody) {
            recentBody.innerHTML = recent.length
                ? recent.map(transactionRow).join("")
                : emptyTableRow(
                    "Add your first income or expense to see it here."
                );
        }

        if (allBody) {
            const filtered = filteredTransactions();

            allBody.innerHTML = filtered.length
                ? filtered.map(transactionRow).join("")
                : emptyTableRow(
                    "Try changing your filters or add a new transaction."
                );

            setText("transaction-count", `${filtered.length} transactions`);
        }

        populateCategoryFilter();
    }

    function populateCategoryFilter() {
        const select = get("category-filter");
        if (!select) return;

        const previous = select.value || "all";

        const categories = [
            ...new Set(state.transactions.map((item) => item.category))
        ].sort();

        select.innerHTML = [
            '<option value="all">All Categories</option>',
            ...categories.map((category) =>
                `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
            )
        ].join("");

        select.value = categories.includes(previous) ? previous : "all";
    }

    // ========================================================
    // 11. MONTHLY BUDGET
    // ========================================================

    function saveMonthlyBudget(event) {
        event?.preventDefault();

        const input = get("monthly-budget-input") || get("budget-limit");
        if (!input) {
            showToast("Budget input was not found.", "error");
            return;
        }

        const amount = number(input.value);

        if (!Number.isFinite(amount) || amount < 0) {
            showToast("Enter a valid budget.", "error");
            return;
        }

        state.settings.monthlyBudget = amount;

        if (!saveState()) return;

        renderAll();
        showToast("Monthly budget updated.");
    }

    function renderBudgets() {
        const summary = calculateSummary();
        const spent = summary.monthlyExpenses;
        const budget = summary.budget;

        setText("budget-page-total", money(budget));
        setText("budget-page-spent", money(spent));
        setText("budget-page-remaining", money(budget - spent));

        const input = get("monthly-budget-input");
        if (input && document.activeElement !== input) {
            input.value = budget || "";
        }

        const list = get("category-budget-list");
        if (!list) return;

        const categories = calculateCategoryTotals();

        if (!categories.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="chart-no-axes-column"></i>
                    </div>
                    <h3>No spending yet</h3>
                    <p>Once you record expenses, your category spending will appear here.</p>
                </div>
            `;
            return;
        }

        list.innerHTML = categories.map((item) => {
            const categoryBudget = state.budgets.find(
                (budgetItem) => budgetItem.category === item.category
            );

            const limit = number(categoryBudget?.limit);
            const percentage = limit > 0 ? item.amount / limit * 100 : 0;

            return `
                <div class="category-budget-item">
                    <div class="category-budget-item-header">
                        <strong>${escapeHTML(item.category)}</strong>
                        <span>${escapeHTML(money(item.amount))}
                            ${limit > 0 ? ` / ${escapeHTML(money(limit))}` : ""}
                        </span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-fill ${percentage >= 100 && limit > 0 ? "danger" : percentage >= 75 ? "warning" : ""}"
                            style="width:${Math.min(percentage, 100)}%">
                        </div>
                    </div>
                    <div class="category-budget-item-footer">
                        <span>${limit > 0
                            ? `${Math.round(percentage)}% of category budget`
                            : "No category limit set"}</span>
                        <button class="text-link"
                            type="button"
                            data-action="edit-category-budget"
                            data-category="${escapeHTML(item.category)}">
                            ${limit > 0 ? "Edit limit" : "Set limit"}
                        </button>
                    </div>
                </div>
            `;
        }).join("");
    }

    function editCategoryBudget(category) {
        const existing = state.budgets.find(
            (item) => item.category === category
        );

        const value = prompt(
            `Enter a monthly spending limit for ${category} (₹):`,
            existing?.limit || ""
        );

        if (value === null) return;

        const limit = Number(value);

        if (!Number.isFinite(limit) || limit < 0) {
            showToast("Enter a valid category budget.", "error");
            return;
        }

        state.budgets = state.budgets.filter(
            (item) => item.category !== category
        );

        state.budgets.push({ category, limit });

        if (!saveState()) return;

        renderBudgets();
        showToast("Category budget saved.");
    }

    // ========================================================
    // 12. SAVINGS GOALS
    // ========================================================

    function openGoalModal(goalId = null) {
        const form = get("goal-form");
        if (!form) {
            showToast("Savings goal form not found in HTML.", "error");
            return;
        }

        editingGoalId = goalId;
        form.reset();

        const goal = goalId
            ? state.goals.find((item) => item.id === goalId)
            : null;

        if (goal) {
            setText("goal-modal-title", "Edit Savings Goal");

            if (get("goal-name")) get("goal-name").value = goal.name;
            if (get("goal-target")) get("goal-target").value = goal.target;
            if (get("goal-saved")) get("goal-saved").value = goal.saved;
            if (get("goal-deadline")) get("goal-deadline").value = goal.deadline || "";
        } else {
            setText("goal-modal-title", "Create Savings Goal");

            if (get("goal-saved")) get("goal-saved").value = 0;
        }

        openModal("goal-modal");
    }

    function submitGoal(event) {
        event.preventDefault();

        const name = get("goal-name")?.value.trim() || "";
        const target = number(get("goal-target")?.value);
        const saved = number(get("goal-saved")?.value);
        const deadline = get("goal-deadline")?.value || "";

        if (!name) {
            showToast("Enter a name for your savings goal.", "error");
            return;
        }

        if (!isValidAmount(target)) {
            showToast("Your savings target must be greater than zero.", "error");
            return;
        }

        if (!Number.isFinite(saved) || saved < 0) {
            showToast("Enter a valid saved amount.", "error");
            return;
        }

        const goal = {
            id: editingGoalId || makeId(),
            name,
            target,
            saved,
            deadline
        };

        if (editingGoalId) {
            const index = state.goals.findIndex(
                (item) => item.id === editingGoalId
            );

            if (index !== -1) state.goals[index] = goal;
        } else {
            state.goals.push(goal);
        }

        if (!saveState()) return;

        closeModal("goal-modal");
        editingGoalId = null;

        renderGoals();
        showToast("Savings goal saved.");
    }

    function renderGoals() {
        const list = get("savings-goals-list");
        const totalTarget = state.goals.reduce(
            (sum, goal) => sum + number(goal.target), 0
        );

        const totalSaved = state.goals.reduce(
            (sum, goal) => sum + number(goal.saved), 0
        );

        setText("savings-target-total", money(totalTarget));
        setText("savings-saved-total", money(totalSaved));
        setText("savings-goals-count", String(state.goals.length));

        if (!list) return;

        if (!state.goals.length) {
            list.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <i data-lucide="piggy-bank"></i>
                    </div>
                    <h3>Start saving for something you love</h3>
                    <p>Create your first goal for a laptop, emergency fund, trip or future expenses.</p>
                    <button class="button button-primary"
                        type="button" data-action="add-goal">
                        <i data-lucide="plus"></i> Create Savings Goal
                    </button>
                </div>
            `;
            return;
        }

        list.innerHTML = state.goals.map((goal) => {
            const percentage = Math.min(
                number(goal.saved) / number(goal.target) * 100,
                100
            );

            const remaining = Math.max(
                number(goal.target) - number(goal.saved),
                0
            );

            return `
                <article class="savings-goal-card">
                    <div class="savings-goal-header">
                        <div>
                            <div class="savings-goal-icon">
                                <i data-lucide="piggy-bank"></i>
                            </div>
                            <h3>${escapeHTML(goal.name)}</h3>
                            <p>${goal.deadline
                                ? `Target date: ${escapeHTML(formatDate(goal.deadline))}`
                                : "No target date set"}</p>
                        </div>
                        <span class="savings-goal-percentage">
                            ${Math.round(percentage)}%
                        </span>
                    </div>

                    <div class="savings-goal-amounts">
                        <strong>${escapeHTML(money(goal.saved))}</strong>
                        <span>Target ${escapeHTML(money(goal.target))}</span>
                    </div>

                    <div class="progress-track">
                        <div class="progress-fill"
                            style="width:${percentage}%"></div>
                    </div>

                    <div class="category-budget-item-footer">
                        <span>${remaining > 0
                            ? `${escapeHTML(money(remaining))} left to save`
                            : "Goal reached!"}</span>
                    </div>

                    <div class="savings-goal-actions">
                        <button class="button button-primary"
                            type="button"
                            data-action="contribute-goal"
                            data-id="${escapeHTML(goal.id)}">
                            <i data-lucide="plus"></i> Add Savings
                        </button>
                        <button class="button button-secondary"
                            type="button"
                            data-action="edit-goal"
                            data-id="${escapeHTML(goal.id)}">
                            Edit
                        </button>
                        <button class="button button-secondary"
                            type="button"
                            data-action="delete-goal"
                            data-id="${escapeHTML(goal.id)}">
                            Delete
                        </button>
                    </div>
                </article>
            `;
        }).join("");
    }

    function contributeToGoal(id) {
        const goal = state.goals.find((item) => item.id === id);
        if (!goal) return;

        const input = prompt(
            `How much would you like to add to "${goal.name}"? (₹)`
        );

        if (input === null) return;

        const amount = Number(input);

        if (!isValidAmount(amount)) {
            showToast("Enter an amount greater than zero.", "error");
            return;
        }

        if (amount > calculateSummary().balance) {
            showToast(
                "This contribution exceeds your current available balance.",
                "error"
            );
            return;
        }

        goal.saved = number(goal.saved) + amount;

        if (!saveState()) return;

        renderGoals();
        showToast("Savings goal updated.");
    }

    // ========================================================
    // 13. SPENDING CHART
    // ========================================================

    function renderSpendingChart() {
        const canvas = get("spending-chart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const month = get("dashboard-month")?.value || currentMonth();
        const categories = calculateCategoryTotals(month);

        const palette = [
            "#14b8a6",
            "#6366f1",
            "#f59e0b",
            "#f43f5e",
            "#8b5cf6",
            "#0ea5e9",
            "#84cc16",
            "#f97316",
            "#64748b",
            "#ec4899"
        ];

        // Use the actual display size and device pixel ratio for clarity.
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(rect.width, 220);
        const height = 220;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = width * ratio;
        canvas.height = height * ratio;

        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const total = categories.reduce(
            (sum, item) => sum + item.amount, 0
        );

        const legend = get("spending-legend");

        if (!categories.length || total <= 0) {
            ctx.fillStyle = "#94a3b8";
            ctx.font = "13px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("No expenses yet", width / 2, height / 2);

            if (legend) {
                legend.innerHTML = `
                    <div class="empty-chart-state">
                        <i data-lucide="chart-pie"></i>
                        <p>Add expenses to see your spending breakdown.</p>
                    </div>
                `;
            }

            return;
        }

        const cx = width / 2;
        const cy = height / 2;
        const radius = Math.min(width * 0.34, height * 0.36);
        const lineWidth = Math.max(18, radius * 0.35);

        let startAngle = -Math.PI / 2;

        categories.forEach((item, index) => {
            const slice = item.amount / total * Math.PI * 2;

            ctx.beginPath();
            ctx.arc(
                cx,
                cy,
                radius,
                startAngle,
                startAngle + slice
            );

            ctx.strokeStyle = palette[index % palette.length];
            ctx.lineWidth = lineWidth;
            ctx.lineCap = "butt";
            ctx.stroke();

            startAngle += slice;
        });

        ctx.fillStyle = "#172033";
        ctx.font = "bold 15px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(money(total), cx, cy);

        ctx.fillStyle = "#64748b";
        ctx.font = "10px sans-serif";
        ctx.fillText("Total spent", cx, cy + 20);

        if (legend) {
            legend.innerHTML = categories.map((item, index) => `
                <div class="legend-item">
                    <span class="legend-dot"
                        style="background:${palette[index % palette.length]}">
                    </span>
                    <span class="legend-label">
                        ${escapeHTML(item.category)}
                    </span>
                    <span class="legend-amount">
                        ${escapeHTML(money(item.amount))}
                    </span>
                </div>
            `).join("");
        }
    }

    // ========================================================
    // 14. NAVIGATION
    // ========================================================

    function navigate(sectionName) {
        const target = get(sectionName);
        if (!target) return;

        $$(".page-section").forEach((section) => {
            section.hidden = section.id !== sectionName;
        });

        $$("[data-section]").forEach((link) => {
            const active = link.dataset.section === sectionName;

            link.classList.toggle("active", active);

            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        const breadcrumb = get("breadcrumb-current");
        if (breadcrumb) {
            const names = {
                dashboard: "Dashboard",
                transactions: "Transactions",
                budgets: "Budgets",
                savings: "Savings Goals",
                settings: "Settings"
            };

            breadcrumb.textContent = names[sectionName] || "Dashboard";
        }

        get("sidebar")?.classList.remove("open");

        window.scrollTo({ top: 0, behavior: "smooth" });

        if (sectionName === "budgets") renderBudgets();
        if (sectionName === "savings") renderGoals();
        if (sectionName === "transactions") renderTransactions();
        if (sectionName === "dashboard") renderSpendingChart();

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // ========================================================
    // 15. CONFIRMATION DIALOG
    // ========================================================

    function askConfirmation(title, message, callback) {
        const modal = get("confirmation-modal");

        if (!modal) {
            // Safe fallback: do not silently delete user data.
            if (window.confirm(`${title}\n\n${message}`)) {
                callback();
            }
            return;
        }

        setText("confirmation-title", title);
        setText("confirmation-message", message);

        pendingConfirmation = callback;

        openModal("confirmation-modal");
    }

    function confirmAction() {
        const callback = pendingConfirmation;
        pendingConfirmation = null;

        closeModal("confirmation-modal");

        if (typeof callback === "function") callback();
    }

    // ========================================================
    // 16. SETTINGS & PERSONAL PROFILE
    // ========================================================

    function renderSettings() {
        const name = get("settings-name");
        const type = get("settings-account-type");
        const currency = get("settings-currency");
        const budget = get("settings-monthly-budget");

        if (name && document.activeElement !== name) {
            name.value = state.profile.name;
        }

        if (type) type.value = state.profile.type;
        if (currency) currency.value = state.settings.currency;
        if (budget && document.activeElement !== budget) {
            budget.value = state.settings.monthlyBudget || "";
        }
    }

    function saveSettings(event) {
        event?.preventDefault();

        const name = get("settings-name")?.value.trim() || "";
        const type = get("settings-account-type")?.value;
        const currency = get("settings-currency")?.value || "INR";
        const budgetInput = get("settings-monthly-budget");

        const budget = budgetInput
            ? number(budgetInput.value)
            : state.settings.monthlyBudget;

        if (!["student", "professional"].includes(type)) {
            showToast("Choose a valid account type.", "error");
            return;
        }

        if (!Number.isFinite(budget) || budget < 0) {
            showToast("Enter a valid monthly budget.", "error");
            return;
        }

        state.profile.name = name;
        state.profile.type = type;
        state.settings.currency = currency;
        state.settings.monthlyBudget = budget;

        if (!saveState()) return;

        renderAll();
        showToast("Settings saved successfully.");
    }

    // ========================================================
    // 17. EXPORT & IMPORT BACKUP
    // ========================================================

    function exportData() {
        const backup = {
            application: "PennyWise",
            version: 1,
            exportedAt: new Date().toISOString(),
            data: state
        };

        const blob = new Blob(
            [JSON.stringify(backup, null, 2)],
            { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `pennywise-backup-${today()}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        showToast("Backup file exported.");
    }

    function importData(file) {
        if (!file) return;

        const reader = new FileReader();

        reader.onload = () => {
            try {
                const parsed = JSON.parse(reader.result);
                const imported = parsed.data || parsed;

                if (
                    !imported ||
                    !Array.isArray(imported.transactions) ||
                    !imported.profile ||
                    !imported.settings
                ) {
                    throw new Error("Invalid backup structure.");
                }

                askConfirmation(
                    "Restore backup?",
                    "This will replace your current PennyWise records with the imported backup.",
                    () => {
                        const defaults = defaultState();

                        state = {
                            ...defaults,
                            ...imported,
                            profile: {
                                ...defaults.profile,
                                ...imported.profile
                            },
                            settings: {
                                ...defaults.settings,
                                ...imported.settings
                            },
                            preferences: {
                                ...defaults.preferences,
                                ...(imported.preferences || {})
                            },
                            transactions: imported.transactions,
                            budgets: Array.isArray(imported.budgets)
                                ? imported.budgets
                                : [],
                            goals: Array.isArray(imported.goals)
                                ? imported.goals
                                : []
                        };

                        if (!saveState()) return;

                        renderAll();
                        showToast("Backup restored successfully.");
                    }
                );
            } catch (error) {
                console.error(error);
                showToast("This file is not a valid PennyWise backup.", "error");
            }
        };

        reader.onerror = () => {
            showToast("Unable to read the selected backup file.", "error");
        };

        reader.readAsText(file);
    }

    function resetAllData() {
        askConfirmation(
            "Reset all data?",
            "This permanently removes your saved profile, transactions, budgets and savings goals from this browser. Export a backup first if you need your records.",
            () => {
                state = defaultState();

                if (!saveState()) return;

                renderAll();
                showAccountSetup();

                showToast("Your local PennyWise data has been reset.");
            }
        );
    }

    // ========================================================
    // 18. PROFILE HEADER
    // ========================================================

    function renderProfile() {
        const name = state.profile.name || (
            state.profile.type === "student"
                ? "Student"
                : "My Account"
        );

        setText("profile-name", name);

        setText(
            "profile-role",
            state.profile.type === "student"
                ? "Student Account"
                : "Professional Account"
        );

        const avatar = get("profile-avatar");

        if (avatar) {
            avatar.textContent = name.charAt(0).toUpperCase();
        }

        setText(
            "current-date",
            new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            })
        );
    }

    // ========================================================
    // 19. LUCIDE ICONS
    // ========================================================

    function refreshIcons() {
        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }

    // ========================================================
    // 20. RENDER EVERYTHING
    // ========================================================

    function renderAll() {
        const setup = get("account-setup");

        if (setup) {
            setup.hidden = Boolean(state.profile.initialized);
        }

        renderProfile();
        renderSummary();
        renderTransactions();
        renderBudgets();
        renderGoals();
        renderSettings();
        renderSpendingChart();
        refreshIcons();
    }

    // ========================================================
    // 21. EVENT LISTENERS
    // ========================================================

    function bindEvents() {
        // Account type selection.
        get("student-option")?.addEventListener(
            "change",
            updateAccountTypeUI
        );

        get("professional-option")?.addEventListener(
            "change",
            updateAccountTypeUI
        );

        // Account setup.
        get("account-setup-form")?.addEventListener(
            "submit",
            setupAccount
        );

        // Navigation.
        $$("[data-section]").forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                navigate(link.dataset.section);
            });
        });

        // Mobile sidebar.
        get("menu-toggle")?.addEventListener("click", () => {
            get("sidebar")?.classList.toggle("open");
        });

        // New transactions.
        get("add-income-btn")?.addEventListener("click", () => {
            openTransactionModal("income");
        });

        get("add-expense-btn")?.addEventListener("click", () => {
            openTransactionModal("expense");
        });

        get("quick-add-income")?.addEventListener("click", () => {
            openTransactionModal("income");
        });

        get("quick-add-expense")?.addEventListener("click", () => {
            openTransactionModal("expense");
        });

        get("transaction-form")?.addEventListener(
            "submit",
            submitTransaction
        );

        get("transaction-income")?.addEventListener("change", () => {
            setTransactionType("income");
        });

        get("transaction-expense")?.addEventListener("change", () => {
            setTransactionType("expense");
        });

        // Modal close buttons.
        $$("[data-close-modal]").forEach((button) => {
            button.addEventListener("click", () => {
                closeModal(button.dataset.closeModal);
            });
        });

        // Clicking the backdrop closes the relevant modal.
        $$(".modal-overlay").forEach((overlay) => {
            overlay.addEventListener("click", (event) => {
                if (event.target === overlay) {
                    closeModal(overlay.id);
                }
            });
        });

        // Escape closes open modals.
        document.addEventListener("keydown", (event) => {
            if (event.key !== "Escape") return;

            $$(".modal-overlay:not([hidden])").forEach((modal) => {
                closeModal(modal.id);
            });

            get("sidebar")?.classList.remove("open");
        });

        // Transaction filters.
        ["transaction-filter", "category-filter"].forEach((id) => {
            get(id)?.addEventListener("change", renderTransactions);
        });

        get("transaction-search")?.addEventListener(
            "input",
            renderTransactions
        );

        // Month selection.
        get("dashboard-month")?.addEventListener("change", () => {
            renderSummary();
            renderSpendingChart();
        });

        // Budget.
        get("monthly-budget-form")?.addEventListener(
            "submit",
            saveMonthlyBudget
        );

        get("save-budget-btn")?.addEventListener(
            "click",
            saveMonthlyBudget
        );

        // Savings goals.
        get("add-goal-btn")?.addEventListener("click", () => {
            openGoalModal();
        });

        get("goal-form")?.addEventListener("submit", submitGoal);

        // Settings.
        get("settings-form")?.addEventListener("submit", saveSettings);

        // Backup / restore.
        get("export-data-btn")?.addEventListener("click", exportData);

        get("import-data-btn")?.addEventListener("click", () => {
            get("import-file-input")?.click();
        });

        get("import-file-input")?.addEventListener("change", (event) => {
            importData(event.target.files?.[0]);
            event.target.value = "";
        });

        get("reset-data-btn")?.addEventListener("click", resetAllData);

        // Confirmation dialog.
        get("confirm-action-btn")?.addEventListener(
            "click",
            confirmAction
        );

        // Printing.
        get("print-report-btn")?.addEventListener("click", () => {
            window.print();
        });

        // Event delegation for dynamically generated buttons.
        document.addEventListener("click", (event) => {
            const button = event.target.closest("[data-action]");
            if (!button) return;

            const action = button.dataset.action;
            const id = button.dataset.id;

            switch (action) {
                case "edit-transaction":
                    openTransactionModal("expense", id);
                    break;

                case "delete-transaction":
                    deleteTransaction(id);
                    break;

                case "add-goal":
                    openGoalModal();
                    break;

                case "edit-goal":
                    openGoalModal(id);
                    break;

                case "delete-goal":
                    askConfirmation(
                        "Delete savings goal?",
                        "This removes this goal from your list.",
                        () => {
                            state.goals = state.goals.filter(
                                (goal) => goal.id !== id
                            );

                            if (!saveState()) return;

                            renderGoals();
                            showToast("Savings goal deleted.");
                        }
                    );
                    break;

                case "contribute-goal":
                    contributeToGoal(id);
                    break;

                case "edit-category-budget":
                    editCategoryBudget(button.dataset.category);
                    break;

                case "show-account-setup":
                    showAccountSetup();
                    break;

                case "show-all-transactions":
                    navigate("transactions");
                    break;

                default:
                    break;
            }

            refreshIcons();
        });

        // Redraw charts on window resizing.
        let resizeFrame = null;

        window.addEventListener("resize", () => {
            if (resizeFrame) cancelAnimationFrame(resizeFrame);

            resizeFrame = requestAnimationFrame(() => {
                renderSpendingChart();
            });
        });
    }

    // ========================================================
    // 22. INITIALIZATION
    // ========================================================

    function init() {
        // Default dates and month selector.
        const transactionDate = get("transaction-date");
        if (transactionDate && !transactionDate.value) {
            transactionDate.value = today();
        }

        const monthSelect = get("dashboard-month");

        if (monthSelect && !monthSelect.value) {
            monthSelect.value =
                state.preferences.selectedMonth || currentMonth();
        }

        // Restore selected account type.
        const student = get("student-option");
        const professional = get("professional-option");

        if (student) student.checked = state.profile.type === "student";
        if (professional) professional.checked = state.profile.type === "professional";

        bindEvents();
        updateAccountTypeUI();
        renderAll();

        // Start on the dashboard.
        navigate("dashboard");

        console.log("PennyWise Expense Tracker initialized.");
    }

    // Public methods.
    return {
        init,
        navigate,
        money,
        calculateSummary,
        exportData,
        renderAll
    };
})();


// ============================================================
// 23. START THE APPLICATION
// ============================================================

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", PennyWise.init);
} else {
    PennyWise.init();
}
