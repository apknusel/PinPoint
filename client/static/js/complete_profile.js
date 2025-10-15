document.addEventListener('DOMContentLoaded', function() {
    checkProfileStatus();
});

async function checkProfileStatus() {
    try {
        const response = await fetch('/api/check-profile-status');
        const data = await response.json();
        
        if (data.logged_in && !data.profile_complete) {
            window.location.href = '/complete_profile';
        }
    } catch (error) {
        console.error('Error checking profile status:', error);
    }
}