(() => {
    "use strict";

    // ==========================================
    // CAMPUSCONNECT APPLICATION ENGINE
    // Supabase posts, media, likes, comments
    // ==========================================

    const $ = id => document.getElementById(id);
    const db = () => window.CampusConnect?.db;

    const state = {
        user: null,
        posts: [],
        filter: "all",
        search: "",
        loading: false,
        openComments: new Set(),
        channels: [],
        interactionVersion: 0
    };

    const BUCKET = "campus-posts";
    const MAX_MEDIA_SIZE = 50 * 1024 * 1024;

    const ALLOWED_MEDIA_TYPES = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/webm",
        "video/quicktime"
    ]);

    const getName = () =>
        state.user?.user_metadata?.full_name ||
        state.user?.email?.split("@")[0] ||
        "Student";

    const getUsername = () =>
        state.user?.user_metadata?.username || "student";

    const initial = value =>
        String(value || "S").trim().charAt(0).toUpperCase() || "S";

    const formatDate = value => {
        if (!value) return "Recently";

        const date = new Date(value);

        return Number.isNaN(date.getTime())
            ? "Recently"
            : date.toLocaleString();
    };

    function notify(message) {
        const status = $("global-status");

        if (status && $("auth-panel") && !$("auth-panel").hidden) {
            status.textContent = message;
            status.className = "status-message info";
            status.hidden = false;
        } else {
            alert(message);
        }
    }

    function showMediaInput() {
        const modalBody = document.querySelector("#postModal .modal-body");

        if (!modalBody) return null;

        let input = $("postMediaInput");

        if (!input) {
            input = document.createElement("input");
            input.type = "file";
            input.id = "postMediaInput";
            input.accept =
                "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

            input.style.display = "block";
            input.style.width = "100%";
            input.style.marginTop = "12px";
            input.style.padding = "10px";

            input.setAttribute(
                "aria-label",
                "Attach a photo or video"
            );

            const hint = document.createElement("small");
            hint.textContent =
                "Optional: add one photo or video (maximum 50 MB).";

            hint.style.display = "block";
            hint.style.marginTop = "8px";
            hint.style.color = "#777";

            modalBody.append(input, hint);
        }

        return input;
    }

    // ==========================================
    // AUTHENTICATION SYNCHRONIZATION
    // ==========================================

    function updateUser(user) {
        state.user = user || null;

        document.querySelectorAll("[data-user-name]").forEach(el => {
            el.textContent = getName();
        });

        document.querySelectorAll("[data-user-email]").forEach(el => {
            el.textContent = state.user?.email || "";
        });

        document.querySelectorAll(".sidebar-profile h4").forEach(el => {
            el.textContent = state.user
                ? getName()
                : "Welcome to CampusConnect";
        });

        if (state.user) {
            loadPosts();
        } else {
            state.posts = [];
            state.openComments.clear();

            removeRealtime();
            renderPosts();
        }
    }

    window.CampusConnectApp = {
        setCurrentUser: updateUser
    };

    // ==========================================
    // PROFILE INFORMATION
    // ==========================================

    async function getProfiles(userIds) {
        const ids = [...new Set((userIds || []).filter(Boolean))];

        const map = new Map();

        if (!ids.length || !db()) return map;

        const { data, error } = await db()
            .from("profiles")
            .select("id, username, full_name, avatar_url")
            .in("id", ids);

        if (error) {
            console.warn(
                "CampusConnect profile lookup:",
                error.message
            );

            return map;
        }

        (data || []).forEach(profile => {
            map.set(profile.id, profile);
        });

        return map;
    }

    // ==========================================
    // LOAD POSTS
    // ==========================================

    async function loadPosts() {
        if (state.loading || !state.user || !db()) return;

        state.loading = true;

        const requestedUserId = state.user.id;

        try {
            const { data, error } = await db()
                .from("posts")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            if (state.user?.id !== requestedUserId) return;

            const rows = data || [];

            const profiles = await getProfiles(
                rows.map(post => post.user_id)
            );

            state.posts = rows.map(post => {
                const profile = profiles.get(post.user_id);

                const own = post.user_id === requestedUserId;

                return {
                    ...post,

                    author: own
                        ? getName()
                        : profile?.full_name ||
                          profile?.username ||
                          "Student",

                    username: own
                        ? getUsername()
                        : profile?.username || "student",

                    avatar_url: profile?.avatar_url || null,

                    likes: 0,
                    comments: 0,
                    liked: false,
                    commentList: []
                };
            });

            await loadInteractions();

            if (state.user?.id !== requestedUserId) return;

            renderPosts();
            subscribeRealtime();

            console.log(
                "CampusConnect: posts, likes and comments loaded."
            );

        } catch (error) {
            console.error(
                "CampusConnect post loading error:",
                error
            );

            const container = $("postsContainer");

            if (container) {
                container.replaceChildren();

                const message = document.createElement("p");

                message.className = "empty-state";

                message.textContent =
                    "Could not load posts: " + error.message;

                container.appendChild(message);
            }

        } finally {
            state.loading = false;
        }
    }

    // ==========================================
    // LOAD LIKES AND COMMENTS FROM SUPABASE
    // ==========================================

    async function loadInteractions() {
        if (!db() || !state.posts.length) return;

        const version = ++state.interactionVersion;

        const postIds = state.posts.map(post => post.id);

        const [likesResult, commentsResult] = await Promise.all([

            db()
                .from("post_likes")
                .select("post_id, user_id")
                .in("post_id", postIds),

            db()
                .from("comments")
                .select(
                    "id, post_id, user_id, content, created_at"
                )
                .in("post_id", postIds)
                .order("created_at", { ascending: true })

        ]);

        if (likesResult.error) throw likesResult.error;

        if (commentsResult.error) throw commentsResult.error;

        if (version !== state.interactionVersion) return;

        const likes = likesResult.data || [];

        const comments = commentsResult.data || [];

        const profiles = await getProfiles(
            comments.map(comment => comment.user_id)
        );

        if (version !== state.interactionVersion) return;

        state.posts.forEach(post => {

            const postLikes = likes.filter(
                row => row.post_id === post.id
            );

            const postComments = comments
                .filter(row => row.post_id === post.id)
                .map(comment => {

                    const profile = profiles.get(comment.user_id);

                    const own =
                        comment.user_id === state.user?.id;

                    return {
                        ...comment,

                        author: own
                            ? getName()
                            : profile?.full_name ||
                              profile?.username ||
                              "Student",

                        isOwn: own
                    };
                });

            post.likes = postLikes.length;

            post.liked = postLikes.some(
                row => row.user_id === state.user?.id
            );

            post.comments = postComments.length;

            post.commentList = postComments;
        });
    }
    // ==========================================
    // REALTIME SUBSCRIPTIONS
    // ==========================================

    function removeRealtime() {
        if (!db()) return;

        state.channels.forEach(channel => {
            db().removeChannel(channel);
        });

        state.channels = [];
    }

    function subscribeRealtime() {
        if (!db() || !state.user || !state.posts.length) return;

        removeRealtime();

        ["post_likes", "comments"].forEach(table => {

            const channel = db()
                .channel(
                    `campusconnect-${table}-${state.user.id}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table
                    },
                    async () => {
                        try {
                            await loadInteractions();
                            renderPosts();

                        } catch (error) {
                            console.error(
                                `Realtime ${table} update:`,
                                error
                            );
                        }
                    }
                )
                .subscribe();

            state.channels.push(channel);
        });
    }

    // ==========================================
    // LIKE / UNLIKE POSTS
    // ==========================================

    async function toggleLike(post, button) {

        if (!db() || !state.user) {
            notify("Please log in to like posts.");
            return;
        }

        if (button.disabled) return;

        button.disabled = true;

        try {

            if (post.liked) {

                const { error } = await db()
                    .from("post_likes")
                    .delete()
                    .eq("post_id", post.id)
                    .eq("user_id", state.user.id);

                if (error) throw error;

            } else {

                const { data: existing, error: checkError } =
                    await db()
                        .from("post_likes")
                        .select("id")
                        .eq("post_id", post.id)
                        .eq("user_id", state.user.id)
                        .maybeSingle();

                if (checkError) throw checkError;

                if (!existing) {

                    const { error } = await db()
                        .from("post_likes")
                        .insert({
                            post_id: post.id,
                            user_id: state.user.id
                        });

                    if (error && error.code !== "23505") {
                        throw error;
                    }
                }
            }

            await loadInteractions();

            renderPosts();

        } catch (error) {

            console.error(
                "CampusConnect like error:",
                error
            );

            alert(
                "Could not update like: " + error.message
            );

        } finally {
            button.disabled = false;
        }
    }

    // ==========================================
    // CREATE COMMENTS
    // ==========================================

     
       
       async function createComment(post, input, button) {

    const content = input.value.trim();

    if (!state.user) {
        alert("Please log in before commenting.");
        return;
    }

    if (!content) {
        input.focus();
        return;
    }

    if (button.disabled) return;

    button.disabled = true;
    button.textContent = "Sending...";

    try {
        console.log("Submitting comment:", {
            post_id: post.id,
            user_id: state.user.id,
            content: content
        });

        const { error } = await db()
            .from("comments")
            .insert({
                post_id: post.id,
                user_id: state.user.id,
                content: content
            });

        if (error) {
            console.error("Supabase insert error:", error);
            throw error;
        }

        console.log("Comment successfully saved.");

        input.value = "";

        state.openComments.add(post.id);

        try {
            await loadInteractions();
            renderPosts();
        } catch (refreshError) {
            console.error("Comment refresh error:", refreshError);
            alert("Comment was saved, but the feed could not refresh. Reload the page.");
        }

    } catch (error) {

        console.error("Comment submission failed:", error);

        alert("Comment failed: " + error.message);

    } finally {

        if (button.isConnected) {
            button.disabled = false;
            button.textContent = "Comment";
        }
    }
}
    // ==========================================
    // DELETE OWN COMMENTS
    // ==========================================

    async function deleteComment(commentId) {

        if (!state.user || !db()) return;

        if (!confirm("Delete this comment?")) return;

        try {

            const { data, error } = await db()
                .from("comments")
                .delete()
                .eq("id", commentId)
                .eq("user_id", state.user.id)
                .select("id");

            if (error) throw error;

            if (!data?.length) {
                throw new Error(
                    "No comment was deleted. You can only delete your own comments."
                );
            }

            await loadInteractions();

            renderPosts();

        } catch (error) {

            console.error(
                "CampusConnect delete comment error:",
                error
            );

            alert(
                "Could not delete comment: " + error.message
            );
        }
    }

    // ==========================================
    // BUILD COMMENTS SECTION
    // ==========================================

     
       
       function buildComments(post) {
    const section = document.createElement("section");
    section.className = "comments-section";

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
        avatar.textContent = initial(comment.author);

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
            const remove = document.createElement("button");

            remove.type = "button";
            remove.className = "delete-comment";
            remove.textContent = "Delete";

            remove.addEventListener("click", () => {
                deleteComment(comment.id);
            });

            item.appendChild(remove);
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
    input.autocomplete = "off";
    input.setAttribute("aria-label", "Write a comment");

    const submit = document.createElement("button");

    submit.type = "submit";
    submit.textContent = "Comment";

    form.append(input, submit);

    form.addEventListener("submit", async event => {
        event.preventDefault();

        await createComment(post, input, submit);
    });

    section.appendChild(form);

    return section;
}

    // ==========================================
    // RENDER POST MEDIA
    // ==========================================

    function renderMedia(post, body) {

        if (!post.image_url) return;

        const url = post.image_url;

        const isVideo =
            /\.(mp4|webm|mov|quicktime)(\?|$)/i.test(url);

        if (isVideo) {

            const video = document.createElement("video");

            video.src = url;

            video.controls = true;

            video.playsInline = true;

            video.preload = "metadata";

            video.className = "post-media";

            body.appendChild(video);

        } else {

            const image = document.createElement("img");

            image.src = url;

            image.alt = "Post attachment";

            image.loading = "lazy";

            image.className = "post-media";

            body.appendChild(image);
        }
    }

    // ==========================================
    // RENDER POSTS
    // ==========================================

    function renderPosts() {

        const container = $("postsContainer");

        if (!container) return;

        const visible = state.posts.filter(post => {

            const categoryMatch =
                state.filter === "all" ||
                String(post.category || "").toLowerCase() ===
                    state.filter;

            const text = [
                post.author,
                post.username,
                post.content,
                post.category
            ].join(" ").toLowerCase();

            return categoryMatch &&
                text.includes(state.search);
        });

        container.replaceChildren();

        if (!visible.length) {

            const empty = document.createElement("div");

            empty.className = "empty-state";

            const title = document.createElement("h3");

            title.textContent = state.posts.length
                ? "No posts found"
                : "No posts yet";

            const message = document.createElement("p");

            message.textContent = state.posts.length
                ? "Try another search or feed category."
                : "Be the first to share something with your campus.";

            empty.append(title, message);

            container.appendChild(empty);

            return;
        }

        visible.forEach(post => {

            const article = document.createElement("article");

            article.className = "post-card";

            article.dataset.category =
                post.category || "social";

            // POST HEADER

            const header = document.createElement("div");

            header.className = "post-header";

            const avatar = document.createElement("div");

            avatar.className = "avatar avatar-purple";

            if (post.avatar_url) {

                const image = document.createElement("img");

                image.src = post.avatar_url;

                image.alt = "";

                avatar.appendChild(image);

            } else {

                avatar.textContent = initial(post.author);
            }

            const authorBox = document.createElement("div");

            authorBox.className = "post-author";

            const author = document.createElement("h4");

            author.textContent = post.author;

            const date = document.createElement("p");

            date.textContent =
                formatDate(post.created_at);

            authorBox.append(author, date);

            header.append(avatar, authorBox);

            // POST BODY

            const body = document.createElement("div");

            body.className = "post-body";

            if (post.content) {

                const paragraph = document.createElement("p");

                paragraph.textContent = post.content;

                body.appendChild(paragraph);
            }

            renderMedia(post, body);

            // POST FOOTER

            const footer = document.createElement("div");

            footer.className = "post-footer";

            // LIKE BUTTON

            const like = document.createElement("button");

            like.type = "button";

            like.className =
                "like-button" +
                (post.liked ? " liked" : "");

            like.setAttribute(
                "aria-pressed",
                String(post.liked)
            );

            const heart = document.createElement("i");

            heart.setAttribute(
                "data-lucide",
                "heart"
            );

            const likeCount = document.createElement("span");

            likeCount.textContent = String(post.likes);

            like.append(heart, likeCount);

            like.addEventListener("click", () => {
                toggleLike(post, like);
            });

            // COMMENTS BUTTON

            const comments = document.createElement("button");

            comments.type = "button";

            comments.className = "comment-button";

            const commentIcon = document.createElement("i");

            commentIcon.setAttribute(
                "data-lucide",
                "message-circle"
            );

            const commentCount = document.createElement("span");

            commentCount.textContent =
                `${post.comments} Comments`;

            comments.append(commentIcon, commentCount);

            comments.addEventListener("click", () => {

                if (state.openComments.has(post.id)) {

                    state.openComments.delete(post.id);

                } else {

                    state.openComments.add(post.id);
                }

                renderPosts();
            });

            // SHARE BUTTON

            const share = document.createElement("button");

            share.type = "button";

            share.className = "share-button";

            share.textContent = "↗ Share";

            share.addEventListener("click", async () => {

                try {

                    await navigator.clipboard.writeText(
                        `${post.content || ""}${post.image_url ? "\n" + post.image_url : ""}`
                    );

                    alert("Post content copied.");

                } catch {

                    alert(
                        post.content ||
                        post.image_url ||
                        "Nothing to share."
                    );
                }
            });

            footer.append(like, comments, share);

            article.append(header, body, footer);

            if (state.openComments.has(post.id)) {

                article.appendChild(
                    buildComments(post)
                );
            }

            container.appendChild(article);
        });

        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }
    // ==========================================
    // CREATE POSTS + MEDIA UPLOAD
    // ==========================================

    async function uploadPostMedia(file) {
        if (!file) return null;

        if (!ALLOWED_MEDIA_TYPES.has(file.type)) {
            throw new Error(
                "Unsupported file type. Choose JPG, PNG, WEBP, GIF, MP4, WEBM or MOV."
            );
        }

        if (file.size > MAX_MEDIA_SIZE) {
            throw new Error("The selected file is larger than 50 MB.");
        }

        const safeName = file.name
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, "_");

        const path = `${state.user.id}/${Date.now()}_${safeName}`;

        const { error } = await db()
            .storage
            .from(BUCKET)
            .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type
            });

        if (error) throw error;

        const { data } = db()
            .storage
            .from(BUCKET)
            .getPublicUrl(path);

        return data.publicUrl;
    }

    function openComposer() {
    const modal = $("postModal");

    if (!modal) {
        notify("Post composer was not found.");
        return;
    }

    showMediaInput();

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");

    $("postContent")?.focus();
}

function closeComposer() {
    const modal = $("postModal");

    if (!modal) return;

    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
}

    async function createPost() {
        if (!state.user || !db()) {
            notify("Please log in before creating a post.");
            return;
        }

        const input = $("postContent");
        const fileInput = showMediaInput();
        const publish = $("publishPost");

        const content = input?.value.trim() || "";
        const file = fileInput?.files?.[0] || null;

        if (!content && !file) {
            alert("Write something or attach a photo/video first.");
            return;
        }

        if (publish) {
            publish.disabled = true;
            publish.textContent = "Publishing...";
        }

        try {
            let mediaUrl = null;

            if (file) {
                mediaUrl = await uploadPostMedia(file);
            }

            const { error } = await db()
                .from("posts")
                .insert({
                    user_id: state.user.id,
                    content,
                    category: "social",
                    image_url: mediaUrl
                });

            if (error) throw error;

            if (input) input.value = "";
            if (fileInput) fileInput.value = "";

            closeComposer();

            await loadPosts();

            alert("Your post has been published.");

        } catch (error) {
            console.error("CampusConnect create post error:", error);
            alert("Could not publish post: " + error.message);

        } finally {
            if (publish) {
                publish.disabled = false;
                publish.textContent = "Publish Post";
            }
        }
    }

    // ==========================================
    // NAVIGATION, FILTERS, SEARCH, COMPOSER
    // ==========================================

    function navigate(page) {
        document.querySelectorAll(".page-section[data-page]").forEach(section => {
            section.classList.toggle(
                "active",
                section.dataset.page === page
            );
        });

        document.querySelectorAll("[data-page]").forEach(item => {
            item.classList.toggle(
                "active",
                item.dataset.page === page
            );
        });

        const title = $("pageTitle");

        if (title) {
            title.textContent =
                page.charAt(0).toUpperCase() + page.slice(1);
        }
    }

    document.addEventListener("click", event => {
        const nav = event.target.closest("[data-page]");

        if (nav) {
            event.preventDefault();
            navigate(nav.dataset.page);
        }
    });

    $("createPostBtn")?.addEventListener("click", openComposer);
    $("openPostComposer")?.addEventListener("click", openComposer);
    $("photoPostBtn")?.addEventListener("click", openComposer);
    $("discussionPostBtn")?.addEventListener("click", openComposer);
    $("studyPostBtn")?.addEventListener("click", openComposer);

    $("closePostModal")?.addEventListener("click", closeComposer);
    $("publishPost")?.addEventListener("click", createPost);

    $("postModal")?.addEventListener("click", event => {
        if (event.target.id === "postModal") {
            closeComposer();
        }
    });

    $("feedFilter")?.addEventListener("change", event => {
        state.filter = event.target.value.toLowerCase();
        renderPosts();
    });

    $("searchInput")?.addEventListener("input", event => {
        state.search = event.target.value.trim().toLowerCase();
        renderPosts();
    });

    // ==========================================
    // INITIALIZATION
    // ==========================================

    const existingUser = window.CampusConnect?.getCurrentUser?.();

    if (existingUser) {
        updateUser(existingUser);
    }

    showMediaInput();

    console.log("CampusConnect application engine loaded.");

})();
 
