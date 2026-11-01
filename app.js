
(() => {
    "use strict";

    const config = window.CAMPUSCONNECT_CONFIG;

    if (
        !window.supabase ||
        !config ||
        !config.SUPABASE_URL ||
        !config.SUPABASE_PUBLISHABLE_KEY ||
        config.SUPABASE_URL.includes("YOUR_") ||
        config.SUPABASE_PUBLISHABLE_KEY.includes("YOUR_")
    ) {
        document.body.innerHTML =
            "<h2 style='padding:30px;color:white'>" +
            "CampusConnect is not configured. Check config.js." +
            "</h2>";
        return;
    }

    const db = window.supabase.createClient(
        config.SUPABASE_URL,
        config.SUPABASE_PUBLISHABLE_KEY
    );

    const get = (id) => document.getElementById(id);

    let currentUser = null;

    function status(message, type = "info") {
        const element = get("global-status");

        element.textContent = message;
        element.className = "status " + type;
    }

    function clearStatus() {
        status("");
    }

    function showAuthView(view) {
        get("auth-panel").hidden = false;
        get("dashboard").hidden = true;

        get("signup-view").hidden = view !== "signup";
        get("login-view").hidden = view !== "login";

        clearStatus();
    }

    async function loadUniversities() {
        const select = get("signup-university");

        const { data, error } = await db
            .from("universities")
            .select("code, name")
            .eq("is_active", true)
            .order("name");

        if (error) throw error;

        select.replaceChildren();

        data.forEach((university) => {
            const option = document.createElement("option");

            option.value = university.code;
            option.textContent = university.name;

            select.appendChild(option);
        });

        if (data.length === 0) {
            throw new Error("No active universities are available.");
        }
    }

    // =====================================
    // REGISTRATION
    // =====================================

    get("signup-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = event.submitter;
        button.disabled = true;

        try {
            const displayName = get("signup-name").value.trim();
            const email = get("signup-email").value.trim();
            const password = get("signup-password").value;
            const universityCode = get("signup-university").value;
            const programme = get("signup-programme").value.trim();
            const studyLevel = get("signup-level").value;

            if (password.length < 8) {
                throw new Error("Password must contain at least 8 characters.");
            }

            status("Creating your account...");

            const { data, error } = await db.auth.signUp({
                email,
                password,

                options: {
                    emailRedirectTo: window.location.href,

                    data: {
                        display_name: displayName,
                        university_code: universityCode,
                        programme,
                        study_level: studyLevel
                    }
                }
            });

            if (error) throw error;

            if (data.session) {
                status("Account created successfully!", "success");
            } else {
                status(
                    "Registration successful. Check your email and verify your account before logging in.",
                    "success"
                );

                get("signup-form").reset();
                return;
            }

        } catch (error) {
            console.error(error);
            status(error.message, "error");

        } finally {
            button.disabled = false;
        }
    });

    // =====================================
    // LOGIN
    // =====================================

    get("login-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const button = event.submitter;
        button.disabled = true;

        try {
            status("Logging you in...");

            const email = get("login-email").value.trim();
            const password = get("login-password").value;

            const { error } = await db.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

        } catch (error) {
            console.error(error);
            status(error.message, "error");

        } finally {
            button.disabled = false;
        }
    });

    // =====================================
    // AUTHENTICATION STATE
    // =====================================

    async function handleSession(session) {
        if (!session) {
            currentUser = null;
            showAuthView("signup");
            return;
        }

        currentUser = session.user;

        get("auth-panel").hidden = true;
        get("dashboard").hidden = false;

        try {
            await loadDashboard();

        } catch (error) {
            console.error(error);
            status(
                "Could not load your profile: " + error.message,
                "error"
            );
        }
    }

    // =====================================
    // STUDENT DASHBOARD
    // =====================================

    async function loadDashboard() {
        const { data: profile, error } = await db
            .from("profiles")
            .select(`
                display_name,
                programme,
                study_level,
                university_id,
                discoverable,
                universities(name)
            `)
            .eq("id", currentUser.id)
            .single();

        if (error) throw error;

        get("student-name").textContent = profile.display_name;
        get("profile-name").textContent = profile.display_name;

        get("student-avatar").textContent =
            profile.display_name.charAt(0).toUpperCase();

        get("profile-programme").textContent =
            profile.programme;

        get("profile-level").textContent =
            profile.study_level;

        get("profile-university").textContent =
            profile.universities?.name || "University";

        get("discoverable-toggle").checked =
            profile.discoverable;

        await loadInterests();
    }

    // =====================================
    // INTEREST SELECTION
    // =====================================

    async function loadInterests() {
        const container = get("interest-options");

        container.textContent = "Loading interests...";

        const { data: interests, error } = await db
            .from("interests")
            .select("id, name, category")
            .order("category")
            .order("name");

        if (error) throw error;

        const { data: selected, error: selectedError } = await db
            .from("user_interests")
            .select("interest_id")
            .eq("user_id", currentUser.id);

        if (selectedError) throw selectedError;

        const selectedIds = new Set(
            selected.map(item => item.interest_id)
        );

        container.replaceChildren();

        interests.forEach((interest) => {
            const label = document.createElement("label");
            label.className = "interest-chip";

            const checkbox = document.createElement("input");

            checkbox.type = "checkbox";
            checkbox.value = interest.id;
            checkbox.checked = selectedIds.has(interest.id);
            checkbox.dataset.interestId = interest.id;

            const text = document.createElement("span");
            text.textContent = interest.name;

            label.append(checkbox, text);

            container.appendChild(label);
        });
    }

    // =====================================
    // SAVE INTERESTS
    // =====================================

    get("save-interests-btn").addEventListener(
        "click",
        async () => {
            const button = get("save-interests-btn");

            const selectedIds = Array.from(
                get("interest-options")
                    .querySelectorAll("input:checked")
            ).map(input => input.value);

            if (selectedIds.length > 10) {
                status(
                    "You can select a maximum of 10 interests.",
                    "error"
                );
                return;
            }

            button.disabled = true;

            try {
                status("Saving your interests...");

                const { error } = await db.rpc(
                    "save_my_interests",
                    {
                        p_interest_ids: selectedIds
                    }
                );

                if (error) throw error;

                status(
                    "Your interests have been saved successfully!",
                    "success"
                );

            } catch (error) {
                console.error(error);
                status(error.message, "error");

            } finally {
                button.disabled = false;
            }
        }
    );

    // =====================================
    // PROFILE PRIVACY
    // =====================================

    get("save-profile-btn").addEventListener(
        "click",
        async () => {
            const button = get("save-profile-btn");

            button.disabled = true;

            try {
                const discoverable =
                    get("discoverable-toggle").checked;

                const { error } = await db
                    .from("profiles")
                    .update({ discoverable })
                    .eq("id", currentUser.id);

                if (error) throw error;

                status(
                    "Your profile settings have been updated.",
                    "success"
                );

            } catch (error) {
                console.error(error);
                status(error.message, "error");

            } finally {
                button.disabled = false;
            }
        }
    );

    // =====================================
    // LOGOUT
    // =====================================

    get("logout-btn").addEventListener("click", async () => {
        const button = get("logout-btn");
        button.disabled = true;

        try {
            const { error } = await db.auth.signOut();

            if (error) throw error;

            status("You have logged out.", "success");

        } catch (error) {
            status(error.message, "error");

        } finally {
            button.disabled = false;
        }
    });

    // =====================================
    // VIEW SWITCHING
    // =====================================

    get("show-login").addEventListener(
        "click",
        () => showAuthView("login")
    );

    get("show-signup").addEventListener(
        "click",
        () => showAuthView("signup")
    );

    // =====================================
    // APPLICATION INITIALIZATION
    // =====================================

    async function initialize() {
        try {
            await loadUniversities();

            const { data, error } = await db.auth.getSession();

            if (error) throw error;

            await handleSession(data.session);

            db.auth.onAuthStateChange((_event, session) => {
                setTimeout(() => {
                    handleSession(session);
                }, 0);
            });

        } catch (error) {
            console.error(error);

            status(
                "Application initialization failed: " + error.message,
                "error"
            );
        }

        // Register PWA service worker.

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("./sw.js")
                .catch(error => {
                    console.error(
                        "Service worker registration failed:",
                        error
                    );
                });
        }
    }

    initialize();

})();
