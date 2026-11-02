
(() => {
    "use strict";

    // ==========================================
    // CAMPUSCONNECT AUTHENTICATION SYSTEM
    // ==========================================

    const CONFIG = {
        url: window.CAMPUSCONNECT_SUPABASE_URL,
        key: window.CAMPUSCONNECT_SUPABASE_PUBLISHABLE_KEY,
        redirectURL: "https://richie-techs.github.io/CampusConnect/"
    };

    const $ = (id) => document.getElementById(id);

    let db = null;
    let currentUser = null;
    let authInitialized = false;

    // ==========================================
    // INITIALIZE SUPABASE
    // ==========================================

    if (!window.supabase || !CONFIG.url || !CONFIG.key) {
        console.error("CampusConnect: Missing Supabase configuration.");
        return;
    }

    db = window.supabase.createClient(
        CONFIG.url,
        CONFIG.key,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );

    // ==========================================
    // STATUS MESSAGES
    // ==========================================

    function showStatus(message, type = "info") {
        const status = $("global-status");

        if (!status) {
            console.log(message);
            return;
        }

        status.textContent = message;
        status.className = `status-message ${type}`;
        status.hidden = false;
    }

    function clearStatus() {
        const status = $("global-status");

        if (status) {
            status.hidden = true;
            status.textContent = "";
        }
    }

    // ==========================================
    // AUTHENTICATION VIEWS
    // ==========================================

    function showLogin() {
        if ($("signup-view")) $("signup-view").hidden = true;
        if ($("login-view")) $("login-view").hidden = false;
        if ($("reset-view")) $("reset-view").hidden = true;

        clearStatus();
    }

    function showSignup() {
        if ($("login-view")) $("login-view").hidden = true;
        if ($("signup-view")) $("signup-view").hidden = false;
        if ($("reset-view")) $("reset-view").hidden = true;

        clearStatus();
    }

    function showResetPassword() {
        if ($("login-view")) $("login-view").hidden = true;
        if ($("signup-view")) $("signup-view").hidden = true;
        if ($("reset-view")) $("reset-view").hidden = false;

        clearStatus();
    }

    function showDashboard() {
        if ($("auth-panel")) $("auth-panel").hidden = true;
        if ($("dashboard")) $("dashboard").hidden = false;

        document.body.classList.add("authenticated");

        const name =
            currentUser?.user_metadata?.full_name ||
            currentUser?.email ||
            "Student";

        document.querySelectorAll("[data-user-name]").forEach(el => {
            el.textContent = name;
        });

        document.querySelectorAll("[data-user-email]").forEach(el => {
            el.textContent = currentUser?.email || "";
        });
    }

    function showAuthentication() {
        if ($("dashboard")) $("dashboard").hidden = true;
        if ($("auth-panel")) $("auth-panel").hidden = false;

        document.body.classList.remove("authenticated");

        showLogin();
    }

    // ==========================================
    // USERNAME GENERATOR
    // ==========================================

    function generateUsername(name) {
        const base = name
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 20) || "student";

        const suffix = Math.floor(
            100000 + Math.random() * 900000
        );

        return `${base}_${suffix}`;
    }

    // ==========================================
    // BUTTON LOADING STATE
    // ==========================================

    function setButtonLoading(button, loading, normalText) {
        if (!button) return;

        button.disabled = loading;
        button.textContent = loading ? "Please wait..." : normalText;
    }

    // ==========================================
    // STUDENT REGISTRATION
    // ==========================================

    const signupForm = $("signup-form");

    signupForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearStatus();

        const fullName = $("signup-name")?.value.trim();
        const email = $("signup-email")?.value.trim().toLowerCase();
        const university = $("signup-university")?.value;
        const programme = $("signup-programme")?.value.trim();
        const level = $("signup-level")?.value;
        const password = $("signup-password")?.value;
        const confirmPassword = $("signup-confirm-password")?.value;

        if (
            !fullName ||
            !email ||
            !university ||
            !programme ||
            !level ||
            !password
        ) {
            showStatus("Please complete all required fields.", "error");
            return;
        }

        if (fullName.length < 3) {
            showStatus("Enter your full name.", "error");
            return;
        }

        if (password.length < 8) {
            showStatus(
                "Your password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (confirmPassword && password !== confirmPassword) {
            showStatus("Passwords do not match.", "error");
            return;
        }

        const button = signupForm.querySelector(
            'button[type="submit"]'
        );

        setButtonLoading(button, true, "Create Account");

        try {
            const username = generateUsername(fullName);

            const { data, error } = await db.auth.signUp({
                email,
                password,

                options: {
                    emailRedirectTo: CONFIG.redirectURL,

                    data: {
                        username,
                        full_name: fullName,
                        university,
                        programme,
                        study_level: level
                    }
                }
            });

            if (error) throw error;

            signupForm.reset();

            if (data.session) {
                currentUser = data.user;
                showDashboard();

                showStatus(
                    "Welcome to CampusConnect! Your account is ready.",
                    "success"
                );
            } else {
                showLogin();

                showStatus(
                    "Account created! Check your email and click the verification link before logging in.",
                    "success"
                );
            }

        } catch (error) {
            console.error("Registration error:", error);

            showStatus(
                error.message || "Unable to create your account.",
                "error"
            );

        } finally {
            setButtonLoading(button, false, "Create Account");
        }
    });

    // ==========================================
    // STUDENT LOGIN
    // ==========================================

    const loginForm = $("login-form");

    loginForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearStatus();

        const email = $("login-email")?.value.trim().toLowerCase();
        const password = $("login-password")?.value;

        if (!email || !password) {
            showStatus("Enter your email and password.", "error");
            return;
        }

        const button = loginForm.querySelector(
            'button[type="submit"]'
        );

        setButtonLoading(button, true, "Login");

        try {
            const { data, error } = await db.auth.signInWithPassword({
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
            console.error("Login error:", error);

            showStatus(
                error.message || "Incorrect email or password.",
                "error"
            );

        } finally {
            setButtonLoading(button, false, "Login");
        }
    });

   
    // ==========================================
    // LOGOUT - IMPROVED VERSION
    // ==========================================

    document.addEventListener("click", async (event) => {
        const button = event.target.closest("#logout-button");

        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        if (button.disabled) return;

        button.disabled = true;
        button.textContent = "Logging out...";

        try {
            const { error } = await db.auth.signOut();

            if (error) throw error;

            currentUser = null;

            showAuthentication();

            showStatus(
                "You have successfully logged out.",
                "success"
            );

        } catch (error) {
            console.error("Logout failed:", error);

            alert(
                "Logout failed: " +
                (error.message || "Please try again.")
            );

        } finally {
            button.disabled = false;
            button.innerHTML =
                '<i data-lucide="log-out"></i>';

            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    });


    // ==========================================
    // SWITCH LOGIN AND REGISTRATION
    // ==========================================

    $("show-login")?.addEventListener("click", showLogin);
    $("show-signup")?.addEventListener("click", showSignup);

    // ==========================================
    // PASSWORD VISIBILITY
    // ==========================================

    document.querySelectorAll("[data-toggle-password]").forEach(button => {
        button.addEventListener("click", () => {
            const input = $(button.dataset.togglePassword);

            if (!input) return;

            input.type =
                input.type === "password" ? "text" : "password";

            button.textContent =
                input.type === "password" ? "Show" : "Hide";
        });
    });

    // ==========================================
    // FORGOT PASSWORD
    // ==========================================

    $("forgot-password")?.addEventListener("click", async () => {
        const email = $("login-email")?.value.trim().toLowerCase();

        if (!email) {
            showStatus(
                "Enter your email address first.",
                "error"
            );
            return;
        }

        try {
            const { error } = await db.auth.resetPasswordForEmail(
                email,
                {
                    redirectTo: CONFIG.redirectURL
                }
            );

            if (error) throw error;

            showStatus(
                "If an account exists for that email, password recovery instructions have been sent.",
                "success"
            );

        } catch (error) {
            showStatus(error.message, "error");
        }
    });

    // ==========================================
    // PASSWORD RECOVERY SCREEN
    // ==========================================

    $("show-reset-password")?.addEventListener(
        "click",
        showResetPassword
    );

    $("update-password-form")?.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const password = $("new-password")?.value;
            const confirm = $("confirm-new-password")?.value;

            if (!password || password.length < 8) {
                showStatus(
                    "Password must contain at least 8 characters.",
                    "error"
                );
                return;
            }

            if (password !== confirm) {
                showStatus("Passwords do not match.", "error");
                return;
            }

            try {
                const { error } = await db.auth.updateUser({
                    password
                });

                if (error) throw error;

                $("update-password-form").reset();

                showLogin();

                showStatus(
                    "Your password has been updated successfully.",
                    "success"
                );

            } catch (error) {
                showStatus(error.message, "error");
            }
        }
    );

    // ==========================================
    // AUTHENTICATION SESSION
    // ==========================================

    async function initializeAuth() {
        try {
            const { data, error } = await db.auth.getSession();

            if (error) throw error;

            currentUser = data.session?.user || null;

            if (currentUser) {
                showDashboard();
            } else {
                showAuthentication();
            }

        } catch (error) {
            console.error("Session error:", error);
            showAuthentication();

        } finally {
            authInitialized = true;
        }
    }

    // ==========================================
    // AUTHENTICATION STATE LISTENER
    // ==========================================

    db.auth.onAuthStateChange((event, session) => {
        if (!authInitialized && event !== "INITIAL_SESSION") {
            return;
        }

        currentUser = session?.user || null;

        if (event === "PASSWORD_RECOVERY") {
            showResetPassword();
            return;
        }

        if (currentUser) {
            showDashboard();
        } else {
            showAuthentication();
        }
    });

    // ==========================================
    // INITIALIZE APPLICATION
    // ==========================================

    window.CampusConnect = {
        db,

        getCurrentUser: () => currentUser,

        signOut: async () => {
            return await db.auth.signOut();
        }
    };

    initializeAuth();

    console.log("CampusConnect authentication loaded.");

})();
