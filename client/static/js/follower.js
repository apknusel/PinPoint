const user_url = new URL(window.location.href);
const pathParts = window.location.pathname.split("/");

const input = document.getElementById('followeeName');
const add_follower = document.getElementById('addFollower');


async function requestFollowing() {
    const followee_id = pathParts[2];
    try {
        const response = await fetch(`/follower_request_create?followee=${encodeURIComponent(followee_id)}`, { method: "POST" });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || "Server Error");
    } catch (e) {
        console.log(e.message);
    }
    add_follower.innerHTML = "pending";
}

async function requestHandler(event, action) {
    const followee_id = pathParts[2];
    const follower_id = event.target.value;
    try {
        const response = await fetch("/follower_request_handler", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ follower: follower_id, followee: followee_id, action: action })
        });
        const data = await response.json();
        if (!response.ok)
            throw new Error(data.error || "Server Error");
        (event.target.closest('li') || event.target.closest('div'))?.remove();
    } catch (e) {
        console.log(e.message);
    }
}