const user_url = new URL(window.location.href);
const pathParts = window.location.pathname.split("/");

const input = document.getElementById('followeeName');
const add_follower = document.getElementById('addFollower');


async function requestFollowing() {
    const followee_id = pathParts[2];
    const prevText = add_follower.innerText;
    add_follower.disabled = true;

    try {
        const response = await fetch(`/follower_request_create?followee=${encodeURIComponent(followee_id)}`, { method: "POST" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Server Error");

        add_follower.innerText = "pending";
    } catch (e) {
        console.log(e.message);
        add_follower.disabled = false;
        add_follower.innerText = prevText;
    }
}

async function requestHandler(event, action) {
    const followee_id = decodeURI(pathParts[2]);
    const follower_id = event.target.value;

    const item = (event.target.closest('li') || event.target.closest('div'));

    try {
        const response = await fetch("/follower_request_handler", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ follower: follower_id, followee: followee_id, action: action })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Server Error");

        if (action === true) {
            const followersList = document.querySelector('.follower-list');
            if (followersList) {
                const name = item?.querySelector('.follower-name')?.textContent?.trim() || 'Follower';
                const picture = item?.querySelector('img.follower-avatar')?.src || '';

                const entry = document.createElement('div');
                entry.className = 'follower-entries';
                entry.dataset.userId = follower_id;

                const img = document.createElement('img');
                img.className = 'follower-avatar';
                img.src = picture;
                img.alt = name;

                const info = document.createElement('div');
                info.className = 'follower-info';

                const h3 = document.createElement('h3');
                h3.className = 'follower-name';
                h3.textContent = name;

                const date = document.createElement('p');
                date.className = 'follower-date';
                date.textContent = 'Just now';

                info.appendChild(h3);
                info.appendChild(date);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'btn btn-remove';
                removeBtn.value = follower_id;
                removeBtn.textContent = 'Remove';
                removeBtn.addEventListener('click', (e) => requestHandler(e, false));

                entry.appendChild(img);
                entry.appendChild(info);
                entry.appendChild(removeBtn);

                followersList.prepend(entry);
            }
        }

        item?.remove();
        cleanupRequests();
    } catch (e) {
        console.log(e.message);
    }

}

async function requestUnfollow() {
    const followee_id = pathParts[2];
    const prevText = add_follower.innerText;
    add_follower.disabled = true;

    try {
        const response = await fetch("/unfollow", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ followee: followee_id })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Server Error");

        add_follower.disabled = false;
        add_follower.innerText = "+ follow";
        add_follower.onclick = requestFollowing;
        add_follower.setAttribute("onclick", "requestFollowing()");
    } catch (e) {
        console.log(e.message);
        add_follower.disabled = false;
        add_follower.innerText = prevText;
    }
}

document.addEventListener('click', (e) => {
    const entry = e.target.closest('.follower-entries');
    if (e.target.closest('button')) {
        return;
    }
    const userId = entry.dataset.userId;
    if (userId) window.location.href = `/profile/${encodeURIComponent(userId)}`;
});

function cleanupRequests() {
    const container = document.querySelector('#requestContainer');
    if (container && container.children.length === 0) {
        const section_title = document.querySelector('#followRequest');
        container.remove();
        if (section_title) {
            section_title.remove();
        }
    }
}
