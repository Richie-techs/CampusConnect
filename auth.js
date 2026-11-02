
(() => {
    "use strict";

    // =========================================
    // CAMPUSCONNECT AUTHENTICATION
    // =========================================

    const SUPABASE_URL = window.CAMPUSCONNECT_SUPABASE_URL;
    const SUPABASE_KEY = window.CAMPUSCONNECT_SUPABASE_PUBLISHABLE_KEY;

    const $ = (id) => document.getElementById(id);

    if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY) {
        console.error("CampusConnect Supabase configuration is missing.");
        return;
    }

    const db = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    let currentUser = null;

    // =========================================
    // STATUS MESSAGES
    // =========================================

    function showStatus(message, type = "info") {
        const status = $("global-status");

        if (!status) {
            alert(message);
            return;
        }

        status.textContent = message;
        status.className = `status-message ${type}`;
        status.hidden = false;
    }

    function clearStatus() {
        const status = $("global-status");
        if (status) status.hidden = true;
    }

    // =========================================
    // AUTHENTICATION VIEWS
    // =========================================

    function showLogin() {
        const signup = $("signup-view");
        const login = $("login-view");

        if (signup) signup.hidden = true;
        if (login) login.hidden = false;

        clearStatus();
    }

    function showSignup() {
        const signup = $("signup-view");
        const login = $("login-view");

        if (login) login.hidden = true;
        if (signup) signup.hidden = false;

        clearStatus();
    }

    function showDashboard() {
        const authPanel = $("auth-panel");
        const dashboard = $("dashboard");

        if (authPanel) authPanel.hidden = true;
        if (dashboard) dashboard.hidden = false;

        document.body.classList.add("authenticated");

        const name = currentUser?.user_metadata?.full_name
            || currentUser?.email
            || "Student";

        const nameElements = document.querySelectorAll(
            "[data-user-name]"
        );

        nameElements.forEach(element => {
            element.textContent = name;
        });
    }

    function showAuthentication() {
        const authPanel = $("auth-panel");
        const dashboard = $("dashboard");

        if (dashboard) dashboard.hidden = true;
        if (authPanel) authPanel.hidden = false;

        document.body.classList.remove("authenticated");
        showLogin();
    }

    // =========================================
    // USERNAME GENERATOR
    // =========================================

    function generateUsername(name) {
        const base = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 20) || "student";

        const random = Math.floor(
            100000 + Math.random() * 900000
        );

        return `${base}_${random}`;
    }

    // =========================================
    // STUDENT REGISTRATION
    // =========================================

    const signupForm = $("signup-form");

    if (signupForm) {
        signupForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearStatus();

            const fullName = $("signup-name")?.value.trim();
            const email = $("signup-email")?.value.trim();
            const university = $("signup-university")?.value;
            const programme = $("signup-programme")?.value.trim();
            const level = $("signup-level")?.value;
            const password = $("signup-password")?.value;

            if (
                !fullName ||
                !email ||
                !university ||
                !programme ||
                !level ||
                !password
            ) {
                showStatus("Complete all registration fields.", "error");
                return;
            }

            if (password.length < 8) {
                showStatus(
                    "Password must contain at least 8 characters.",
                    "error"
                );
                return;
            }

            const button = signupForm.querySelector(
                'button[type="submit"]'
            );

            if (button) {
                button.disabled = true;
                button.textContent = "Creating account...";
            }

            try {
                const { data, error } = await db.auth.signUp({
                    email,
                    password,

                    options: {
                        emailRedirectTo:
                            window.location.origin +
                            window.location.pathname,

                        data: {
                            username: generateUsername(fullName),
                            full_name: fullName,
                            university: university,
                            programme: programme,
                            study_level: level
                        }
                    }
                });

                if (error) throw error;

                if (data.session) {
                    currentUser = data.user;
                    showDashboard();

                    showStatus(
                        "Your CampusConnect account has been created.",
                        "success"
                    );
                } else {
                    signupForm.reset();
                    showLogin();

                    showStatus(
                        "Registration successful! Check your email to verify your account before logging in.",
                        "success"
                    );
                }

            } catch (error) {
                console.error(error);

                showStatus(
                    error.message || "Registration failed.",
                    "error"
                );

            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = "Create Account";
                }
            }
        });
    }

    // =========================================
    // STUDENT LOGIN
    // =========================================

    const loginForm = $("login-form");

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearStatus();

            const email = $("login-email")?.value.trim();
            const password = $("login-password")?.value;

            if (!email || !password) {
                showStatus("Enter your email and password.", "error");
                return;
            }

            const button = loginForm.querySelector(
                'button[type="submit"]'
            );

            if (button) {
                button.disabled = true;
                button.textContent = "Signing in...";
            }

            try {
                const { data, error } =
                    await db.auth.signInWithPassword({
                        email,
                        password
                    });

                if (error) throw error;

                currentUser = data.user;

                loginForm.reset();
                showDashboard();

                showStatus(
                    "Welcome back to CampusConnect!",
                    "success"
                );

            } catch (error) {
                console.error(error);

                showStatus(
                    error.message || "Login failed.",
                    "error"
                );

            } finally {
                if (button) {
                    button.disabled = false;
                    button.textContent = "Login";
                }
            }
        });
    }

    // =========================================
    // LOGOUT
    // =========================================

    const logoutButton = $("logout-button");

    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            const { error } = await db.auth.signOut();

            if (error) {
                showStatus(error.message, "error");
                return;
            }

            currentUser = null;
            showAuthentication();

            showStatus("You have logged out successfully.", "success");
        });
    }

    // =========================================
    // SWITCH AUTHENTICATION VIEWS
    // =========================================

    $("show-login")?.addEventListener("click", showLogin);
    $("show-signup")?.addEventListener("click", showSignup);

    // =========================================
    // PASSWORD RECOVERY
    // =========================================

    const forgotPassword = $("forgot-password");

    if (forgotPassword) {
        forgotPassword.addEventListener("click", async () => {
            const email = $("login-email")?.value.trim();

            if (!email) {
                showStatus(
                    "Enter your email address first.",
                    "error"
                );
                return;
            }

            const { error } = await db.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo:
                        window.location.origin +
                        window.location.pathname
                }
            );

            if (error) {
                showStatus(error.message, "error");
            } else {
                showStatus(
                    "Password recovery instructions have been sent if the account exists.",
                    "success"
                );
            }
        });
    }

    // =========================================
    // RESTORE EXISTING SESSION
    // =========================================

    async function initializeAuth() {
        const { data, error } = await db.auth.getSession();

        if (error) {
            console.error(error);
            showAuthentication();
            return;
        }

        currentUser = data.session?.user || null;

        if (currentUser) {
            showDashboard();
        } else {
            showAuthentication();
        }
    }

    db.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;

        if (currentUser) {
            showDashboard();
        } else {
            showAuthentication();
        }
    });

    initializeAuth();

    // Make database client available to other application modules.
    window.CampusConnect = {
        db,
        getCurrentUser: () => currentUser
    };

    console.log("CampusConnect authentication initialized.");

})();
                
