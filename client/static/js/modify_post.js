const current_url = window.location.href;
const path_parts = window.location.pathname.split("/");
const post_id = path_parts[path_parts.length - 1];

function autoAdjustTextArea(o) {
    o.style.height = '1px';
    o.style.height = o.scrollHeight + 'px';
}

window.addEventListener("DOMContentLoaded", () => {
    const delete_btn = document.getElementById("postDelete");
    const modify_btn = document.getElementById("postModify");
    const post_caption = document.getElementById("postCaptionTextarea")
    const popup = document.getElementById("myPopup");

    autoAdjustTextArea(post_caption);
    post_caption.addEventListener("keyup", () => autoAdjustTextArea(post_caption));

    if (modify_btn && delete_btn) {
        modify_btn.addEventListener("click", modifyPost);
        delete_btn.addEventListener("click", deletePost);
    }

    is_editing = false;
    is_delete = false;

    async function modifyPost() {
        const { map, overlay, toggleBtn, marker, } = postPage;

        if (is_editing) {
            const caption = post_caption.value;
            const { lng, lat } = marker.getLngLat();

            try {
                const response = await update_post(post_id, caption, lng, lat);

                console.log(response);
                if (response === "success") {
                    post_caption.setAttribute("readonly", true);
                    post_caption.style.backgroundColor = "white";
                    post_caption.style.outline = "none";

                    overlay.style.width = '15%';
                    overlay.style.height = '15%';

                    toggleBtn.innerHTML = '<i data-lucide="maximize"></i>';
                    toggleBtn.setAttribute('aria-label', 'Expand map');

                    modify_btn.style.backgroundColor = "white";
                    modify_btn.innerHTML = `<svg 
                                    xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" 
                                    stroke="#000000" stroke-width="3" stroke-linecap="square" stroke-linejoin="arcs">
                                    <polygon points="14 2 18 6 7 17 3 17 3 13 14 2"></polygon> <line x1="3" y1="22" x2="21" y2="22"></line>
                                    </svg>`

            is_editing = false;
                    postPage.isExpanded = false;
                    postPage.initialCenter = [lng, lat];
            if (postPage.disableEditingInteractions) postPage.disableEditingInteractions();
                    lucide.createIcons();

                } else {
                    console.warn("Failed to update post", response);
                }
            } catch (e) {
                console.error("Error: ", e);
            }
        } else {

            post_caption.removeAttribute("readonly");
            post_caption.focus();
            post_caption.style.backgroundColor = "#f3f0f9ff";

            overlay.style.width = '50%';
            overlay.style.height = '50%';

            toggleBtn.innerHTML = '<i data-lucide="minimize"></i>';
            toggleBtn.setAttribute('aria-label', 'Collapse map');

            modify_btn.style.backgroundColor = "#58c775"
            modify_btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
                                    stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" 
                                    class="lucide lucide-arrow-big-up-dash-icon lucide-arrow-big-up-dash">
                                    <path d="M9 13a1 1 0 0 0-1-1H5.061a1 1 0 0 1-.75-1.811l6.836-6.835a1.207 1.207 0 0 1 1.707 0l6.835 6.835a1 1 0 0 1-.75 1.811H16a1 1 0 0 0-1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/>
                                    <path d="M9 20h6"/></svg>`

            is_editing = true;
            postPage.isExpanded = true;
            // Ensure POIs are visible and easy to click while editing
            try {
                const targetZoom = 14;
                const { lng, lat } = marker.getLngLat();
                // Center the map exactly on the current marker position when entering edit
                const centerNow = () => map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), targetZoom) });
                let centered = false;
                const onResize = () => {
                    if (centered) return;
                    centered = true;
                    requestAnimationFrame(centerNow);
                };
                // If the overlay resize triggers a map.resize, wait for it; otherwise center next frame
                map.once && map.once('resize', onResize);
                requestAnimationFrame(() => { if (!centered) centerNow(); });
                if (postPage.enableEditingInteractions) postPage.enableEditingInteractions();
            } catch (e) {}
            lucide.createIcons();
        }
    }

    function deletePost() {
        if (is_delete) {
            window.location.href = `/delete_post/${post_id}`;
        } else {

            setTimeout(() => {
                document.addEventListener("click", resetDelete);
            }, 0);

            popup.classList.add("show");
            delete_btn.style.backgroundColor = "#de4e6a";
            is_delete = true;
        }
    }

    function resetDelete(e) {
        if (e.target !== delete_btn) {
            popup.classList.remove("show");
            delete_btn.style.backgroundColor = "white";
            is_delete = false;
            document.removeEventListener("click", resetDelete);
        }
    }

});

async function update_post(post_id, caption, lng, lat) {
    try {
        const response = await fetch(`/update_post/${post_id}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                caption: caption,
                lng: lng,
                lat: lat,
            }),
        });

        if (!response.ok) {
            throw new Error(response.status);
        }

        const status = await response.text();
        return status;

    } catch (error) {
        console.error(error);
    }
}




