

(() => {
    "use strict";

    // ==========================================
    // CAMPUSCONNECT APPLICATION ENGINE
    // Likes, Comments, Profiles and Realtime
    // ==========================================

    const $ = id => document.getElementById(id);

    const state = {
        user: null,
        posts: [],
        filter: "all",
        search: "",
        loadingPosts: false,
        openComments: new Set(),
        likesChannel: null,
        commentsChannel: null,
        interactionVersion: 0
    };

    const getDB = () => window.CampusConnect?.db;

    const getUserName = () =>
        state.user?.user_metadata?.full_name ||
        state.user?.email ||
        "Student";

    const getUsername = () =>
        state.user?.user_metadata?.username ||
        "student";

    const getAvatar = () =>
        getUserName().charAt(0).toUpperCase();

    const escapeHTML = value =>
        String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);

    function formatDate(value) {
        if (!value) return "Recently";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "Recently"
            : date.toLocaleString();
    }

    function getProfileName(profile) {
        return profile?.full_name ||
            profile?.username ||
            "Student";
    }

    // ==========================================
    // AUTHENTICATION SYNCHRONIZATION
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
            state.openComments.clear();
            removeRealtimeSubscriptions();
            renderPosts();
        }
    }

    window.CampusConnectApp = {
        setCurrentUser: updateUser
    };

    // ==========================================
    // LOAD POSTS
    // ==========================================

    async function loadInitialPosts() {
        const container = $("postsContainer");
        const db = getDB();

        if (!container || !db || !state.user) return;
        if (state.loadingPosts) return;

        state.loadingPosts = true;

        const loadingUserId = state.user.id;

        try {
            const { data, error } = await db
                .from("posts")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (state.user?.id !== loadingUserId) return;

            const posts = data || [];

            // Load profile information
            const userIds = [...new Set(posts.map(p => p.user_id))];

            const profiles = new Map();

            if (userIds.length) {
                const { data: profileData, error: profileError } =
                    await db
                        .from("profiles")
                        .select("id, username, full_name, avatar_url")
                        .in("id", userIds);

                if (profileError) throw profileError;

                (profileData || []).forEach(profile => {
                    profiles.set(profile.id, profile);
                });
            }

            if (state.user?.id !== loadingUserId) return;

            state.posts = posts.map(post => {
                const profile = profiles.get(post.user_id);
                const ownPost = post.user_id === state.user?.id;

                return {
                    ...post,
                    author: ownPost
                        ? getUserName()
                        : getProfileName(profile),

                    username: ownPost
                        ? getUsername()
                        : profile?.username || "student",

                    avatar_url: profile?.avatar_url || null,
                    details: formatDate(post.created_at),
                    likes: 0,
                    comments: 0,
                    liked: false,
                    commentList: []
                };
            });

            await loadInteractions();
            if (state.user?.id !== loadingUserId) return;

            renderPosts();
            subscribeToRealtime();

            console.log(
                "CampusConnect: Posts and interactions loaded."
            );

        } catch (error) {
            console.error("Post loading error:", error);
        } finally {
            state.loadingPosts = false;
        }
    }

    // ==========================================
    // LOAD LIKES AND COMMENTS
    // ==========================================

    async function loadInteractions() {
        const db = getDB();

        if (!db || !state.posts.length) return;

        const postIds = state.posts.map(post => post.id);
        const version = ++state.interactionVersion;

        const [likesResult, commentsResult] = await Promise.all([
            db.from("post_likes")
                .select("post_id, user_id")
                .in("post_id", postIds),

            db.from("comments")
                .select("id, post_id, user_id, content, created_at")
                .in("post_id", postIds)
                .order("created_at", { ascending: true })
        ]);

        if (likesResult.error) throw likesResult.error;
        if (commentsResult.error) throw commentsResult.error;

        if (version !== state.interactionVersion) return;

        const likes = likesResult.data || [];
        const comments = commentsResult.data || [];

        const commentUserIds = [
            ...new Set(comments.map(comment => comment.user_id))
        ];

        const profiles = new Map();

        if (commentUserIds.length) {
            const { data, error } = await db
                .from("profiles")
                .select("id, username, full_name, avatar_url")
                .in("id", commentUserIds);

            if (error) throw error;

            (data || []).forEach(profile => {
                profiles.set(profile.id, profile);
            });
        }

        if (version !== state.interactionVersion) return;

        state.posts.forEach(post => {
            const postLikes = likes.filter(
                like => like.post_id === post.id
            );

            const postComments = comments
                .filter(comment => comment.post_id === post.id)
                .map(comment => {
                    const profile = profiles.get(comment.user_id);

                    return {
                        ...comment,
                        author: comment.user_id === state.user?.id
                            ? getUserName()
                            : getProfileName(profile),

                        username: profile?.username || "student",
                        avatar_url: profile?.avatar_url || null,
                        isOwn: comment.user_id === state.user?.id
                    };
                });

            post.likes = postLikes.length;

            post.liked = postLikes.some(
                like => like.user_id === state.user?.id
            );

            post.comments = postComments.length;
            post.commentList = postComments;
        });
    }

    // ==========================================
    // LIKE / UNLIKE POSTS
    // ==========================================

    async function toggleLike(post, button) {
        const db = getDB();

        if (!db || !state.user) {
            alert("Please log in to like posts.");
            return;
        }

        if (button.disabled) return;

        button.disabled = true;

        const wasLiked = post.liked;

        try {
            if (wasLiked) {
                const { error } = await db
                    .from("post_likes")
                    .delete()
                    .eq("post_id", post.id)
                    .eq("user_id", state.user.id);

                if (error) throw error;

            } else {
                // Check for an existing like before inserting.
                const { data: existing, error: checkError } = await db
                    .from("post_likes")
                    .select("id")
                    .eq("post_id", post.id)
                    .eq("user_id", state.user.id)
                    .maybeSingle();

                if (checkError) throw checkError;

                if (!existing) {
                    const { error } = await db
                        .from("post_likes")
                        .insert({
                            post_id: post.id,
                            user_id: state.user.id
                        });

                    if (error) throw error;
                }
            }

            await loadInteractions();
            renderPosts();

        } catch (error) {
            console.error("Like error:", error);
            alert("Could not update like: " + error.message);

        } finally {
            button.disabled = false;
        }
    }

    // ==========================================
    // CREATE COMMENTS
    // ==========================================

    async function createComment(post, input, button) {
        const db = getDB();

        if (!db || !state.user) {
            alert("Please log in to comment.");
            return;
        }

        const content = input.value.trim();

        if (!content) {
            input.focus();
            return;
        }

        if (content.length > 5000) {
            alert("Comments cannot exceed 5000 characters.");
            return;
        }

        button.disabled = true;
        button.textContent = "Sending...";

        try {
            const { error } = await db
                .from("comments")
                .insert({
                    post_id: post.id,
                    user_id: state.user.id,
                    content: content
                });

            if (error) throw error;

            input.value = "";

            await loadInteractions();
            renderPosts();

        } catch (error) {
            console.error("Comment error:", error);
            alert("Could not submit comment: " + error.message);

        } finally {
            button.disabled = false;
            button.textContent = "Comment";
        }
    }

    // ==========================================
    // DELETE OWN COMMENTS
    // ==========================================

    async function deleteComment(commentId, post) {
        const db = getDB();

        if (!db || !state.user) return;

        const confirmed = confirm(
            "Are you sure you want to delete this comment?"
        );

        if (!confirmed) return;

        try {
            const { data, error } = await db
                .from("comments")
                .delete()
                .eq("id", commentId)
                .eq("user_id", state.user.id)
                .select("id");

            if (error) throw error;

            if (!data?.length) {
                throw new Error("Comment could not be deleted.");
            }

            await loadInteractions();
            renderPosts();

        } catch (error) {
            console.error("Delete comment error:", error);
            alert("Could not delete comment: " + error.message);
        }
    }

    // ==========================================
    // COMMENT SECTION RENDERING
    // ==========================================

    function createCommentsSection(post) {
        const section = document.createElement("div");
        section.className = "comments-section";

        if (!state.openComments.has(post.id)) {
            section.hidden = true;
            return section;
        }

        const heading = document.createElement("h4");
        heading.textContent = "Comments";
        section.appendChild(heading);

        const list = document.createElement("div");
        list.className = "comments-list";

        if (!post.commentList.length) {
            const empty = document.createElement("p");
            empty.className = "no-comments";
            empty.textContent = "No comments yet. Start the conversation!";
            list.appendChild(empty);
        }

        post.commentList.forEach(comment => {
            const item = document.createElement("div");
            item.className = "comment-item";

            const avatar = document.createElement("div");
            avatar.className = "comment-avatar";
            avatar.textContent =
                comment.author.charAt(0).toUpperCase();

            const content = document.createElement("div");
            content.className = "comment-content";

            const author = document.createElement("strong");
            author.textContent = comment.author;

            const date = document.createElement("small");
            date.textContent = formatDate(comment.created_at);

            const message = document.createElement("p");
            message.textContent = comment.content;

            content.append(author, date, message);
            item.append(avatar, content);

            if (comment.isOwn) {
                const deleteButton = document.createElement("button");
                deleteButton.type = "button";
                deleteButton.className = "delete-comment";
                deleteButton.textContent = "Delete";

                deleteButton.addEventListener("click", () => {
                    deleteComment(comment.id, post);
                });

                item.appendChild(deleteButton);
            }

            list.appendChild(item);
        });

        section.appendChild(list);

        // Comment form
        const form = document.createElement("form");
        form.className = "comment-form";

        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Write a comment...";
        input.maxLength = 5000;
        input.required = true;

        const button = document.createElement("button");
        button.type = "submit";
        button.textContent = "Comment";

        form.append(input, button);

        form.addEventListener("submit", event => {
            event.preventDefault();
            createComment(post, input, button);
        });

        section.appendChild(form);

        return section;
    }

    // ==========================================
    // RENDER POSTS
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

            return matchesCategory &&
                searchableText.includes(state.search);
        });

        container.replaceChildren();

        if (!visiblePosts.length) {
            const empty = document.createElement("div");
            empty.className = "empty-state";

            const heading = document.createElement("h3");
            heading.textContent = "No posts found";

            const message = document.createElement("p");
            message.textContent = state.posts.length
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

            if (post.avatar_url) {
                const avatarImage = document.createElement("img");
                avatarImage.src = post.avatar_url;
                avatarImage.alt = "";
                avatar.appendChild(avatarImage);
            } else {
                avatar.textContent =
                    post.author.charAt(0).toUpperCase();
            }

            const authorInfo = document.createElement("div");
            authorInfo.className = "post-author";

            const author = document.createElement("h4");
            author.textContent = post.author;

            const details = document.createElement("p");
            details.textContent = post.details;

            authorInfo.append(author, details);
            header.append(avatar, authorInfo);

            // Body
            const body = document.createElement("div");
            body.className = "post-body";

            const paragraph = document.createElement("p");
            paragraph.textContent = post.content;
            body.appendChild(paragraph);

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

            // Like
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
            likeCount.textContent = String(post.likes);

            likeButton.append(likeIcon, likeCount);

            likeButton.addEventListener("click", () => {
                toggleLike(post, likeButton);
            });

            // Comments toggle
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
                if (state.openComments.has(post.id)) {
                    state.openComments.delete(post.id);
                } else {
                    state.openComments.add(post.id);
                }

                renderPosts();
            });

            // Share
            const shareButton = document.createElement("button");
            shareButton.type = "button";

            const shareIcon = document.createElement("i");
            shareIcon.setAttribute("data-lucide", "repeat-2");

            const shareText = document.createElement("span");
            shareText.textContent = "Share";

            shareButton.append(shareIcon, shareText);

            shareButton.addEventListener("click", async () => {
                const shareTextContent =
                    `${post.content}\n\nCampusConnect`;

                try {
                    await navigator.clipboard.writeText(
                        shareTextContent
                    );
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

            const commentsSection =
                createCommentsSection(post);

            article.append(
                header,
                body,
                footer,
                commentsSection
            );

            container.appendChild(article);
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // ==========================================
    // REALTIME SUBSCRIPTIONS
    // ==========================================

    function removeRealtimeSubscriptions() {
        const db = getDB();

        if (!db) return;

        if (state.likesChannel) {
            db.removeChannel(state.likesChannel);
            state.likesChannel = null;
        }

        if (state.commentsChannel) {
            db.removeChannel(state.commentsChannel);
            state.commentsChannel = null;
        }
    }

    function subscribeToRealtime() {
        const db = getDB();

        if (!db || !state.user) return;

        removeRealtimeSubscriptions();

        state.likesChannel = db
            .channel("campusconnect-post-likes")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "post_likes"
                },
                async () => {
                    try {
                        await loadInteractions();
                        renderPosts();
                    } catch (error) {
                        console.error("Realtime likes error:", error);
                    }
                }
            )
            .subscribe();

        state.commentsChannel = db
            .channel("campusconnect-post-comments")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "comments"
                },
                async () => {
                    try {
                        await loadInteractions();
                        renderPosts();
                    } catch (error) {
                        console.error("Realtime comments error:", error);
                    }
                }
            )
            .subscribe();
    }

    // ==========================================
    // NAVIGATION
    // ==========================================

    function navigate(page) {
        if (!page) return;

        document.querySelectorAll(".page-section").forEach(section => {
            const sectionPage =
                section.dataset.page ||
                section.id.replace("page-", "");

            section.classList.toggle(
                "active",
                sectionPage === page
            );
        });

        document.querySelectorAll("[data-page], [data-nav]").forEach(item => {
            const destination =
                item.dataset.page || item.dataset.nav;

            item.classList.toggle("active", destination === page);
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
    // SEARCH AND FILTER
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
    // PUBLISH POST
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

        const db = getDB();

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
                    content,
                    category: "social"
                })
                .select()
                .single();

            if (error) throw error;

            input.value = "";

            state.filter = "all";
            state.search = "";

            if ($("feedFilter")) {
                $("feedFilter").value = "all";
            }

            if ($("searchInput")) {
                $("searchInput").value = "";
            }

            await loadInitialPosts();

            closePostModal();
            navigate("home");

            alert("Your post has been published!");

        } catch (error) {
            console.error("Publishing error:", error);
            alert("Could not publish post: " + error.message);

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
    // INITIALIZE
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
