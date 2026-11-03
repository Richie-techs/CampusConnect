
(() => {
    "use strict";

    // ==========================================
    // CAMPUSCONNECT APPLICATION ENGINE
    // Matched to current index.html and style.css
    // ==========================================

    const $ = id => document.getElementById(id);

    const state = {
        user: null,
        posts: [],
        filter: "all",
        search: ""
    };

    const getUserName = () =>
        state.user?.user_metadata?.full_name ||
        state.user?.email ||
        "Student";

    const getUsername = () =>
        state.user?.user_metadata?.username ||
        "student";

    const getAvatar = () =>
        getUserName().charAt(0).toUpperCase();

    // ==========================================
    // AUTHENTICATED USER
    // ==========================================

    function updateUser(user) {
        state.user = user || null;

        const name = getUserName();
        const avatar = getAvatar();

        document.querySelectorAll("[data-user-name]").forEach(el => {
            el.textContent = name;
        });

        document.querySelectorAll(".sidebar-profile h4").forEach(el => {
            el.textContent = name;
        });

        document.querySelectorAll(".avatar-purple").forEach(el => {
            el.textContent = avatar;
        });

        renderPosts();
    }

    // Authentication system can call this after login.
    window.CampusConnectApp = {
        setCurrentUser: updateUser
    };

    // ==========================================
    // INITIAL POSTS
    // Read existing HTML posts instead of
    // destroying the original feed.
    // ==========================================

    function loadInitialPosts() {
        const container = $("postsContainer");

        if (!container) {
            console.error("postsContainer was not found.");
            return;
        }

        const cards = container.querySelectorAll(".post-card");

        state.posts = Array.from(cards).map((card, index) => {
            const category = (
                card.dataset.category || "general"
            ).toLowerCase();

            const author =
                card.querySelector(".post-author h4")?.textContent.trim() ||
                card.querySelector(".post-header h4")?.textContent.trim() ||
                "Student";

            const content =
                card.querySelector(".post-body p")?.textContent.trim() ||
                "";

            const details =
                card.querySelector(".post-author p")?.textContent.trim() ||
                "";

            const likeCount = Number(
                card.querySelector(".like-button span")?.textContent || 0
            );

            const commentText =
                card.querySelector(".comment-button span")?.textContent || "";

            const commentCount = Number(
                commentText.match(/\d+/)?.[0] || 0
            );

            return {
                id: `sample-${index}`,
                author,
                username: author.toLowerCase().replace(/\s+/g, "_"),
                details,
                content,
                category,
                likes: likeCount,
                comments: commentCount,
                liked: false,
                time: details.split("·").pop()?.trim() || "Recently"
            };
        });
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    function navigate(page) {
        if (!page) return;

        const sections = document.querySelectorAll(".page-section");

        sections.forEach(section => {
            const sectionPage =
                section.dataset.page ||
                section.id.replace("page-", "");

            section.classList.toggle(
                "active",
                sectionPage === page
            );
        });

        document.querySelectorAll(
            "[data-page], [data-nav]"
        ).forEach(item => {
            const destination =
                item.dataset.page || item.dataset.nav;

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

        closePostModal();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.addEventListener("click", event => {
        const nav = event.target.closest("[data-page], [data-nav]");

        if (!nav) return;

        // Do not interfere with logout or other actions.
        if (nav.id === "logout-button") return;

        const page = nav.dataset.page || nav.dataset.nav;

        if (page) {
            event.preventDefault();
            navigate(page);
        }
    });

    // ==========================================
    // FEED RENDERING
    // ==========================================

    function renderPosts() {
        const container = $("postsContainer");

        if (!container) return;

        const visiblePosts = state.posts.filter(post => {
            const matchesCategory =
                state.filter === "all" ||
                post.category === state.filter;

            const text = (
                post.author + " " +
                post.username + " " +
                post.details + " " +
                post.content
            ).toLowerCase();

            const matchesSearch =
                text.includes(state.search);

            return matchesCategory && matchesSearch;
        });

        container.replaceChildren();

        if (!visiblePosts.length) {
            const empty = document.createElement("div");
            empty.className = "empty-state";

            const heading = document.createElement("h3");
            heading.textContent = "No posts found";

            const message = document.createElement("p");
            message.textContent =
                "Try another search or choose a different category.";

            empty.append(heading, message);
            container.appendChild(empty);
            return;
        }

        visiblePosts.forEach(post => {
            const article = document.createElement("article");
            article.className = "post-card";

            article.dataset.category = post.category;

            const header = document.createElement("div");
            header.className = "post-header";

            const avatar = document.createElement("div");
            avatar.className = "avatar avatar-purple";
            avatar.textContent =
                post.isNew ? getAvatar() : post.author.charAt(0);

            const authorInfo = document.createElement("div");
            authorInfo.className = "post-author";

            const author = document.createElement("h4");
            author.textContent = post.author;

            const details = document.createElement("p");
            details.textContent = post.details || post.time;

            authorInfo.append(author, details);
            header.append(avatar, authorInfo);

            const body = document.createElement("div");
            body.className = "post-body";

            const paragraph = document.createElement("p");
            paragraph.textContent = post.content;

            body.appendChild(paragraph);

            const footer = document.createElement("div");
            footer.className = "post-footer";

            const likeButton = document.createElement("button");
            likeButton.className =
                "like-button" + (post.liked ? " liked" : "");

            const likeIcon = document.createElement("i");
            likeIcon.setAttribute("data-lucide", "heart");

            const likeCount = document.createElement("span");
            likeCount.textContent = post.likes;

            likeButton.setAttribute(
                "aria-pressed",
                String(post.liked)
            );

            likeButton.append(likeIcon, likeCount);

            likeButton.addEventListener("click", () => {
                post.liked = !post.liked;
                post.likes = Math.max(
                    0,
                    post.likes + (post.liked ? 1 : -1)
                );
                renderPosts();
            });

            const commentButton = document.createElement("button");
            commentButton.className = "comment-button";

            const commentIcon = document.createElement("i");
            commentIcon.setAttribute(
                "data-lucide",
                "message-circle"
            );

            const commentCount = document.createElement("span");
            commentCount.textContent =
                `${post.comments} Comments`;

            commentButton.append(commentIcon, commentCount);

            commentButton.addEventListener("click", () => {
                alert("Comments will be connected to Supabase next.");
            });

            const shareButton = document.createElement("button");

            const shareIcon = document.createElement("i");
            shareIcon.setAttribute("data-lucide", "repeat-2");

            const shareText = document.createElement("span");
            shareText.textContent = "Share";

            shareButton.append(shareIcon, shareText);

            shareButton.addEventListener("click", async () => {
                try {
                    await navigator.clipboard.writeText(post.content);
                    alert("Post copied!");
                } catch {
                    alert(post.content);
                }
            });

            footer.append(
                likeButton,
                commentButton,
                shareButton
            );

            article.append(header, body, footer);
            container.appendChild(article);
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // ==========================================
    // CREATE POST MODAL
    // IMPORTANT: CSS uses .active, not .show
    // ==========================================

    const modal = $("postModal");

    function openPostModal() {
        if (!modal) {
            console.error("Post modal not found.");
            return;
        }

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");

        $("postContent")?.focus();
    }

    function closePostModal() {
        if (!modal) return;

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
    }

    [
        "createPostBtn",
        "openPostComposer",
        "openPostModal"
    ].forEach(id => {
        $(id)?.addEventListener("click", event => {
            event.preventDefault();
            openPostModal();
        });
    });

    $("closePostModal")?.addEventListener(
        "click",
        closePostModal
    );

    modal?.addEventListener("click", event => {
        if (event.target === modal) {
            closePostModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePostModal();
        }
    });

    // ==========================================
    // PUBLISH POST
    // ==========================================

    function createPost() {
        const input = $("postContent");

        if (!input) {
            alert("Post editor not found.");
            return;
        }

        const content = input.value.trim();

        if (!content) {
            alert("Please write something before publishing.");
            input.focus();
            return;
        }

        const newPost = {
            id: `post-${Date.now()}`,
            author: getUserName(),
            username: getUsername(),
            details: "Just now",
            time: "Just now",
            content,
            category: "social",
            likes: 0,
            comments: 0,
            liked: false,
            isNew: true
        };

        state.posts.unshift(newPost);

        input.value = "";
        state.filter = "all";
        state.search = "";

        if ($("feedFilter")) {
            $("feedFilter").value = "all";
        }

        if ($("searchInput")) {
            $("searchInput").value = "";
        }

        renderPosts();
        closePostModal();
        navigate("home");
    }

    $("publishPost")?.addEventListener("click", event => {
        event.preventDefault();
        createPost();
    });

    // ==========================================
    // SEARCH
    // ==========================================

    $("searchInput")?.addEventListener("input", event => {
        state.search = event.target.value
            .trim()
            .toLowerCase();

        renderPosts();
    });

    // ==========================================
    // FEED FILTERS
    // ==========================================

    $("feedFilter")?.addEventListener("change", event => {
        state.filter = event.target.value.toLowerCase();
        renderPosts();
    });

    // ==========================================
    // PHOTO / DISCUSSION / STUDY BUTTONS
    // ==========================================

    $("photoPostBtn")?.addEventListener("click", () => {
        openPostModal();
        alert("Photo uploads will be connected to Supabase Storage.");
    });

    $("discussionPostBtn")?.addEventListener("click", () => {
        openPostModal();
    });

    $("studyPostBtn")?.addEventListener("click", () => {
        openPostModal();
    });

    // ==========================================
    // LOGOUT VISIBILITY
    // Actual signOut is handled by auth.js.
    // Do not create a second logout handler.
    // ==========================================

    const logoutButton = $("logout-button");

    if (logoutButton) {
        logoutButton.style.display = "flex";
        logoutButton.title = "Logout";
        logoutButton.setAttribute("aria-label", "Logout");
    }

    // ==========================================
    // INITIALIZE
    // ==========================================

    loadInitialPosts();
    renderPosts();

    console.log("CampusConnect application engine ready.");

})();
