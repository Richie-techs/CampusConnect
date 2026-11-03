
(() => {
    "use strict";

    // ==========================================
    // CAMPUSCONNECT APPLICATION ENGINE
    // ==========================================

    const $ = id => document.getElementById(id);

    const state = {
        user: null,
        posts: [],
        filter: "all",
        search: "",
        loadingPosts: false
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
    // USER AUTHENTICATION SYNCHRONIZATION
    // ==========================================

    function updateUser(user) {
        state.user = user || null;

        document.querySelectorAll("[data-user-name]").forEach(el => {
            el.textContent = getUserName();
        });

        document.querySelectorAll("[data-user-email]").forEach(el => {
            el.textContent = state.user?.email || "";
        });

        document.querySelectorAll(".sidebar-profile h4").forEach(el => {
            el.textContent = getUserName();
        });

        document.querySelectorAll(".avatar-purple").forEach(el => {
            el.textContent = getAvatar();
        });

        if (state.user) {
            loadInitialPosts();
        } else {
            state.posts = [];
            renderPosts();
        }
    }

    window.CampusConnectApp = {
        setCurrentUser: updateUser
    };

    // ==========================================
    // LOAD POSTS FROM SUPABASE
    // ==========================================

    async function loadInitialPosts() {
        const container = $("postsContainer");
        const db = window.CampusConnect?.db;

        if (!container) {
            console.error("CampusConnect: postsContainer missing.");
            return;
        }

        if (!db) {
            console.error("CampusConnect: Supabase client missing.");
            return;
        }

        if (!state.user) return;

        if (state.loadingPosts) return;

        state.loadingPosts = true;

        try {
            const { data, error } = await db
                .from("posts")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            state.posts = (data || []).map(post => {
                const isOwnPost =
                    post.user_id === state.user?.id;

                const date = post.created_at
                    ? new Date(post.created_at)
                    : null;

                return {
                    id: post.id,
                    user_id: post.user_id,

                    author: isOwnPost
                        ? getUserName()
                        : "Student",

                    username: isOwnPost
                        ? getUsername()
                        : "student",

                    details: date
                        ? date.toLocaleString()
                        : "Recently",

                    time: date
                        ? date.toLocaleString()
                        : "Recently",

                    content: post.content || "",
                    category: post.category || "social",
                    image_url: post.image_url,

                    likes: 0,
                    comments: 0,
                    liked: false,
                    isNew: false
                };
            });

            renderPosts();

            console.log(
                "CampusConnect: Posts loaded:",
                state.posts.length
            );

        } catch (error) {
            console.error("Could not load posts:", error);
        } finally {
            state.loadingPosts = false;
        }
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

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    document.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        const nav = target.closest("[data-page], [data-nav]");

        if (!nav || nav.id === "logout-button") return;

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

            const searchableText = [
                post.author,
                post.username,
                post.details,
                post.content
            ].join(" ").toLowerCase();

            const matchesSearch =
                searchableText.includes(state.search);

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
                state.posts.length
                    ? "Try another search or category."
                    : "Be the first to share something with your campus.";

            empty.append(heading, message);
            container.appendChild(empty);
            return;
        }

        visiblePosts.forEach(post => {
            const article = document.createElement("article");
            article.className = "post-card";
            article.dataset.category = post.category;

            // Header
            const header = document.createElement("div");
            header.className = "post-header";

            const avatar = document.createElement("div");
            avatar.className = "avatar avatar-purple";
            avatar.textContent =
                post.author.charAt(0).toUpperCase();

            const authorInfo = document.createElement("div");
            authorInfo.className = "post-author";

            const author = document.createElement("h4");
            author.textContent = post.author;

            const details = document.createElement("p");
            details.textContent = post.details || post.time;

            authorInfo.append(author, details);
            header.append(avatar, authorInfo);

            // Post content
            const body = document.createElement("div");
            body.className = "post-body";

            const paragraph = document.createElement("p");
            paragraph.textContent = post.content;

            body.appendChild(paragraph);

            // Optional image
            if (post.image_url) {
                const image = document.createElement("img");
                image.src = post.image_url;
                image.alt = "Post attachment";
                image.loading = "lazy";
                body.appendChild(image);
            }

            // Footer
            const footer = document.createElement("div");
            footer.className = "post-footer";

            // Like button
            const likeButton = document.createElement("button");
            likeButton.type = "button";
            likeButton.className =
                "like-button" + (post.liked ? " liked" : "");

            likeButton.setAttribute(
                "aria-pressed",
                String(post.liked)
            );

            const likeIcon = document.createElement("i");
            likeIcon.setAttribute("data-lucide", "heart");

            const likeCount = document.createElement("span");
            likeCount.textContent = post.likes;

            likeButton.append(likeIcon, likeCount);

            likeButton.addEventListener("click", () => {
                post.liked = !post.liked;

                post.likes = Math.max(
                    0,
                    post.likes + (post.liked ? 1 : -1)
                );

                renderPosts();
            });

            // Comments button
            const commentButton = document.createElement("button");
            commentButton.type = "button";
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

            // Share button
            const shareButton = document.createElement("button");
            shareButton.type = "button";

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
    // FEED SEARCH AND FILTER
    // ==========================================

    $("feedFilter")?.addEventListener("change", event => {
        state.filter = event.target.value;
        renderPosts();
    });

    $("searchInput")?.addEventListener("input", event => {
        state.search = event.target.value.toLowerCase().trim();
        renderPosts();
    });

    // ==========================================
    // POST COMPOSER
    // ==========================================

    const modal = $("postModal");

    function openPostModal() {
        if (!modal) {
            console.error("Post modal #postModal was not found.");
            return;
        }

        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");

        const input = $("postContent");

        if (input) {
            setTimeout(() => input.focus(), 100);
        }
    }

    function closePostModal() {
        if (!modal) return;

        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
    }

    document.addEventListener("click", event => {
        const target = event.target;

        if (!(target instanceof Element)) return;

        const openButton = target.closest(
            "#createPostBtn, #openPostComposer, #openPostModal, #discussionPostBtn, #studyPostBtn, #photoPostBtn"
        );

        if (openButton) {
            event.preventDefault();
            openPostModal();
            return;
        }

        const closeButton = target.closest(
            "#closePostModal, #closePostComposer"
        );

        if (closeButton) {
            event.preventDefault();
            closePostModal();
            return;
        }

        if (target === modal) {
            closePostModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePostModal();
        }
    });

    // ==========================================
    // PUBLISH POST TO SUPABASE
    // ==========================================

    async function createPost() {
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

        const db = window.CampusConnect?.db;

        const user =
            window.CampusConnect?.getCurrentUser?.() ||
            state.user;

        if (!db || !user?.id) {
            alert("Please log in before publishing.");
            return;
        }

        const button = $("publishPost");

        if (button) {
            button.disabled = true;
            button.textContent = "Publishing...";
        }

        try {
            const { data, error } = await db
                .from("posts")
                .insert({
                    user_id: user.id,
                    content: content,
                    category: "social"
                })
                .select()
                .single();

            if (error) throw error;

            const newPost = {
                id: data.id,
                user_id: data.user_id,
                author: getUserName(),
                username: getUsername(),
                details: "Just now",
                time: "Just now",
                content: data.content,
                category: data.category || "social",
                image_url: data.image_url,
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

            alert("Your post has been published!");

        } catch (error) {
            console.error("Publishing error:", error);

            alert(
                "Could not publish post: " + error.message
            );

        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = "Publish";
            }
        }
    }

    $("publishPost")?.addEventListener("click", event => {
        event.preventDefault();
        createPost();
    });

    // ==========================================
    // INITIALIZE APPLICATION
    // ==========================================

    const existingUser =
        window.CampusConnect?.getCurrentUser?.();

    if (existingUser) {
        updateUser(existingUser);
    } else {
        renderPosts();
    }

    console.log("CampusConnect application engine ready.");

})();
