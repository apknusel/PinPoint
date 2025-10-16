// TODO: replace with /profile/<name>/posts
const url = "/profile/__name__";
const search_input = document.getElementById('searchInput');
const search_results = document.getElementById('searchbarDropdown');
const searchbar_wrapper = document.getElementById('searchbarWrapper');
search_input.addEventListener('input', filterFunction);

async function filterFunction() {
  let user_data = [];
  const filter = search_input.value;
  
  if (!filter) {
    search_results.innerHTML = "";
    return;
  }

  try {
    const response = await fetch(`/api/search_users?name=${encodeURIComponent(filter)}`);
    if (!response.ok) throw new Error("Fetch error");
    user_data = await response.json();
  } catch (err) {
    console.log(err);
    return;
  }

  search_results.innerHTML = "";

  if (!user_data.length) {
    searchbar_wrapper.className = "searchbar-wrapper";
    const empty = document.createElement('div');
    empty.className = 'dropdown-entries';
    empty.innerText = 'No results';
    search_results.appendChild(empty);
    return;
  }

  for (const { user_id, nickname, display_name, picture } of user_data) {
    user = createElement(nickname, display_name, picture);
    search_results.append(user);
  }
}

function createElement(nickname, display_name, picture) {
  const link = document.createElement('a');
  link.href = url.replace('__name__', encodeURIComponent(nickname));
  link.className = "dropdown-entries";

  const img = document.createElement('img');
  img.src = String(picture);
  img.className = "user-avatar";

  const text = document.createElement('span');
  text.innerText = display_name;

  link.appendChild(img);
  link.appendChild(text);

  return link;
}
