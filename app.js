
(() => {
    "use strict";

    // =====================================
    // CAMPUSCONNECT - APPLICATION ENGINE
    // =====================================

    const $ = (id) => document.getElementById(id);

    let currentUser = {
        id: "user-001",
        name: "Richard Mensah",
        username: "richard",
        avatar: "R"
    };

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

    // =====================================
    // NAVIGATION
    // =====================================

    function navigate(page) {
        document.querySelectorAll("[data-page]").forEach(section => {
            section.classList.toggle(
                "active",
                section.dataset.page === page
            );
        });

        document.querySelectorAll("[data-nav]").forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.nav === page
            );
        });

        const title = $("pageTitle");

        if (title) {
            title.textContent =
                page.charAt(0).toUpperCase() + page.slice(1);
        }
    }

    document.querySelectorAll("[data-nav]").forEach(item => {
        item.addEventListener("click", () => {
            navigate(item.dataset.nav);
        });
    });

    // =====================================
    // POST RENDERING
    // =====================================

    function renderPosts() {
        const container = $("postsContainer");

        if (!container) return;

        const filtered = posts.filter(post => {
            return activeFilter === "All" ||
                   post.category === activeFilter;
        });

        container.innerHTML = "";

        filtered.forEach(post => {
            const article = document.createElement("article");

            article.className = "post-card";

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

            const content = document.createElement("p");
            content.className = "post-content";
            content.textContent = post.content;

            const actions = document.createElement("div");
            actions.className = "post-actions";

            const like = document.createElement("button");
            like.className = "post-action";
            like.textContent =
                `${post.liked ? "❤️" : "🤍"} ${post.likes} Likes`;

            like.addEventListener("click", () => {
                post.liked = !post.liked;
                post.likes += post.liked ? 1 : -1;
                renderPosts();
            });

            const comment = document.createElement("button");
            comment.className = "post-action";
            comment.textContent = `💬 ${post.comments} Comments`;

            comment.addEventListener("click", () => {
                alert("Comments will be connected to Supabase next.");
            });

            const share = document.createElement("button");
            share.className = "post-action";
            share.textContent = "↗ Share";

            share.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(post.content);
                    alert("Post copied!");
                } catch {
                    alert(post.content);
                }
            });

            actions.append(like, comment, share);

            article.append(header, content, actions);
            container.appendChild(article);
        });
    }

    // =====================================
    // CREATE POST
    // =====================================

    function createPost() {
        const input = $("postInput");

        if (!input) return;

        const content = input.value.trim();

        if (!content) {
            alert("Please write something first.");
            return;
        }

        posts.unshift({
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
        });

        input.value = "";

        renderPosts();
        navigate("home");
    }

    const publishButton = $("publishPost");

    if (publishButton) {
        publishButton.addEventListener("click", createPost);
    }

    // =====================================
    // POST FILTERS
    // =====================================

    document.querySelectorAll("[data-filter]").forEach(button => {
        button.addEventListener("click", () => {
            activeFilter = button.dataset.filter;

            document.querySelectorAll("[data-filter]").forEach(item => {
                item.classList.toggle(
                    "active",
                    item === button
                );
            });

            renderPosts();
        });
    });

    // =====================================
    // SEARCH
    // =====================================

    const searchInput = $("searchInput");

    if (searchInput) {
        searchInput.addEventListener("input", () => {
            const query = searchInput.value.toLowerCase();

            document.querySelectorAll(".post-card").forEach(card => {
                card.style.display =
                    card.textContent.toLowerCase().includes(query)
                    ? ""
                    : "none";
            });
        });
    }

    // =====================================
    // CREATE POST MODAL
    // =====================================

    const openModal = $("openPostModal");
    const closeModal = $("closePostModal");
    const modal = $("postModal");

    if (openModal && modal) {
        openModal.addEventListener("click", () => {
            modal.classList.add("show");
        });
    }

    if (closeModal && modal) {
        closeModal.addEventListener("click", () => {
            modal.classList.remove("show");
        });
    }

    // =====================================
    // INITIALIZATION
    // =====================================

    renderPosts();

    console.log("CampusConnect initialized successfully.");

})();
