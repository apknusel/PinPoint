// TODO: replace with /profile/<name>/posts
const url = "/profile/__name__";
const search_input = document.getElementById('searchInput');
const search_results = document.getElementById('searchbarDropdown');

// Hide dropdown initially
search_results.style.display = "none";

search_input.addEventListener('input', filterFunction);

async function filterFunction() {
  let user_data = [];
  const filter = search_input.value;

  if (!filter) {
    search_results.innerHTML = "";
    search_results.style.display = "none";
    return;
  }

  try {
    const response = await fetch(`/api/search_users?name=${encodeURIComponent(filter)}`);
    if (!response.ok) throw new Error("Fetch error");
    user_data = await response.json();
  } catch (err) {
    console.log(err);
    search_results.innerHTML = "";
    search_results.style.display = "none";
    return;
  }

  // Clear results after fetch completes to prevent race condition duplicates
  search_results.innerHTML = "";
  search_results.style.display = "none";

  // Check if search input has changed while request was in flight
  if (search_input.value !== filter) {
    return;
  }

  if (!user_data.length) {
    return;
  }

  for (const { user_id, nickname, picture } of user_data) {
    const user = createElement(nickname, picture);
    search_results.append(user);
  }
  search_results.style.display = "block";
}

function createElement(name, picture) {
  const link = document.createElement('a');
  link.href = url.replace('__name__', encodeURIComponent(name));
  link.className = "dropdown-entries";

  const img = document.createElement('img');
  img.src = String(picture);
  img.className = "user-avatar";

  const text = document.createElement('span');
  text.innerText = name;

  link.appendChild(img);
  link.appendChild(text);

  return link;
}
