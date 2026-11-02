
(() => {
    "use strict";

    // ==========================================
    // CAMPUSCONNECT - APPLICATION ENGINE
    // Frontend repair version
    // ==========================================

    const $ = (id) => document.getElementById(id);

    const firstElement = (...ids) => {
        for (const id of ids) {
            const element = $(id);
            if (element) return element;
        }
        return null;
    };

    // ==========================================
    // APPLICATION STATE
    // ==========================================

    let currentUser = {
        id: null,
        name: "Student",
        username: "student",
        avatar: "S"
    };

    // Allow the authentication system to supply the user.
    function setCurrentUser(user) {
        if (!user) return;

        currentUser = {
            id: user.id || null,
            name: user.name || user.full_name || user.email || "Student",
            username: user.username || "student",
            avatar: user.avatar || (user.name || "S").charAt(0).toUpperCase()
        };

        renderPosts();
    }

    window.CampusConnectApp = {
        setCurrentUser
    };

    if (window.CAMPUSCONNECT_USER) {
        setCurrentUser(window.CAMPUSCONNECT_USER);
    }

    // Temporary sample data.
    // Supabase integration will replace this storage.
    let posts = [
        {
            id: 1,
            author: "Ama Serwaa",
            username: "ama_serwaa",
            avatar: "A",
            time: "12 minutes ago",
            content: "Anyone preparing for the upcoming Computer Science quiz? Let's create a study group!",
            likes: 24,
            comments: 8,
            liked: false,
            category: "Academic"
        },
        {
            id: 2,
            author: "Kwame Boateng",
            username: "kwame_b",
            avatar: "K",
            time: "35 minutes ago",
            content: "University life becomes easier when you surround yourself with people who share your goals. Keep pushing!",
            likes: 42,
            comments: 12,
            liked: false,
            category: "General"
        }
    ];

    let activeFilter = "All";
    let searchQuery = "";

    // ==========================================
    // NAVIGATION
    // ==========================================

    function navigate(page) {
        if (!page) return;

        document.querySelectorAll("[data-page]").forEach(section => {
            section.classList.toggle(
                "active",
                section.dataset.page === page
            );
        });

        const navItems = document.querySelectorAll(
            "[data-nav], nav [data-page], .sidebar [data-page], .bottom-nav [data-page]"
        );

        navItems.forEach(item => {
            const destination = item.dataset.nav || item.dataset.page;

            item.classList.toggle(
                "active",
                destination === page
            );
        });

        const title = $("pageTitle");

        if (title) {
            title.textContent =
                page.charAt(0).toUpperCase() + page.slice(1);
        }

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    // Support both navigation attribute formats.
    document.querySelectorAll(
        "[data-nav], nav [data-page], .sidebar [data-page], .bottom-nav [data-page]"
    ).forEach(item => {
        item.addEventListener("click", event => {
            event.preventDefault();

            const page = item.dataset.nav || item.dataset.page;

            navigate(page);
        });
    });

    // ==========================================
    // POST RENDERING
    // ==========================================

    function renderPosts() {
        const container = $("postsContainer");

        if (!container) return;

        const filteredPosts = posts.filter(post => {
            const matchesCategory =
                activeFilter === "All" ||
                post.category === activeFilter;

            const searchableText = (
                post.author + " " +
                post.username + " " +
                post.content
            ).toLowerCase();

            const matchesSearch =
                searchableText.includes(searchQuery);

            return matchesCategory && matchesSearch;
        });

        container.replaceChildren();

        if (filteredPosts.length === 0) {
            const emptyMessage = document.createElement("p");

            emptyMessage.className = "empty-state";
            emptyMessage.textContent = "No posts found.";

            container.appendChild(emptyMessage);
            return;
        }

        filteredPosts.forEach(post => {
            const article = document.createElement("article");
            article.className = "post-card";

            // Header
            const header = document.createElement("div");
            header.className = "post-header";

            const avatar = document.createElement("div");
            avatar.className = "post-avatar";
            avatar.textContent = post.avatar;

            const authorInfo = document.createElement("div");

            const author = document.createElement("strong");
            author.textContent = post.author;

            const username = document.createElement("small");
            username.textContent =
                `@${post.username} · ${post.time}`;

            authorInfo.append(author, username);
            header.append(avatar, authorInfo);

            // Content
            const content = document.createElement("p");
            content.className = "post-content";
            content.textContent = post.content;

            // Actions
            const actions = document.createElement("div");
            actions.className = "post-actions";

            // Like button
            const likeButton = document.createElement("button");
            likeButton.type = "button";
            likeButton.className = "post-action";

            likeButton.setAttribute(
                "aria-pressed",
                String(post.liked)
            );

            likeButton.textContent =
                `${post.liked ? "❤️" : "🤍"} ${post.likes} Likes`;

            likeButton.addEventListener("click", () => {
                post.liked = !post.liked;

                post.likes = Math.max(
                    0,
                    post.likes + (post.liked ? 1 : -1)
                );

                renderPosts();
            });

            // Comment button
            const commentButton = document.createElement("button");
            commentButton.type = "button";
            commentButton.className = "post-action";
            commentButton.textContent =
                `💬 ${post.comments} Comments`;

            commentButton.addEventListener("click", () => {
                if (typeof window.openComments === "function") {
                    window.openComments(post.id);
                } else {
                    alert(
                        "The comments interface has not been connected yet."
                    );
                }
            });

            // Share button
            const shareButton = document.createElement("button");
            shareButton.type = "button";
            shareButton.className = "post-action";
            shareButton.textContent = "↗ Share";

            shareButton.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(post.content);
                    alert("Post copied to clipboard!");
                } catch {
                    alert(post.content);
                }
            });

            actions.append(
                likeButton,
                commentButton,
                shareButton
            );

            article.append(
                header,
                content,
                actions
            );

            container.appendChild(article);
        });
    }

    // ==========================================
    // CREATE POST
    // ==========================================

    function createPost() {
        const input = firstElement(
            "postContent",
            "postInput"
        );

        if (!input) {
            console.error("Post textarea was not found.");
            alert("Post editor could not be found.");
            return;
        }

        const content = input.value.trim();

        if (!content) {
            alert("Please write something first.");
            input.focus();
            return;
        }

        const newPost = {
            id: Date.now(),
            author: currentUser.name,
            username: currentUser.username,
            avatar: currentUser.avatar,
            time: "Just now",
            content,
            likes: 0,
            comments: 0,
            liked: false,
            category: "General"
        };

        posts.unshift(newPost);

        input.value = "";

        renderPosts();
        navigate("home");
        closePostModal();
    }

    const publishButton = firstElement(
        "publishPost",
        "submitPostBtn"
    );

    if (publishButton) {
        publishButton.addEventListener("click", event => {
            event.preventDefault();
            createPost();
        });
    }

    // ==========================================
    // POST FILTERS
    // Supports buttons AND select dropdown.
    // ==========================================

    function updateFilter(filter) {
        activeFilter = filter || "All";

        document.querySelectorAll("[data-filter]").forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.filter === activeFilter
            );
        });

        const filterSelect = $("feedFilter");

        if (filterSelect && filterSelect.value !== activeFilter) {
            filterSelect.value = activeFilter;
        }

        renderPosts();
    }

    document.querySelectorAll("[data-filter]").forEach(button => {
        button.addEventListener("click", () => {
            updateFilter(button.dataset.filter);
        });
    });

    const feedFilter = $("feedFilter");

    if (feedFilter) {
        feedFilter.addEventListener("change", () => {
            updateFilter(feedFilter.value);
        });
    }

    // ==========================================
    // SEARCH
    // ==========================================

    const searchInput = $("searchInput");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            searchQuery = searchInput.value
                .trim()
                .toLowerCase();

            renderPosts();
        });
    }

    // ==========================================
    // POST COMPOSER MODAL
    // Supports old and new HTML IDs.
    // ==========================================

    const modal = $("postModal");

    function openPostModal() {
        if (!modal) return;

        modal.classList.add("show");
        modal.setAttribute("aria-hidden", "false");

        const input = firstElement(
            "postContent",
            "postInput"
        );

        if (input) {
            input.focus();
        }
    }

    function closePostModal() {
        if (!modal) return;

        modal.classList.remove("show");
        modal.setAttribute("aria-hidden", "true");
    }

    const openModalButtons = [
        $("openPostModal"),
        $("openPostComposer"),
        $("createPostBtn")
    ].filter(Boolean);

    openModalButtons.forEach(button => {
        button.addEventListener("click", event => {
            event.preventDefault();
            openPostModal();
        });
    });

    const closeModalButton = firstElement(
        "closePostModal",
        "closePostComposer"
    );

    if (closeModalButton) {
        closeModalButton.addEventListener(
            "click",
            closePostModal
        );
    }

    if (modal) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closePostModal();
            }
        });
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePostModal();
        }
    });

    // ==========================================
    // INITIALIZATION
    // ==========================================

    renderPosts();

    console.log(
        "CampusConnect application engine initialized."
    );

})();

