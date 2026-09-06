export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;

    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "className") {
      node.className = value;
    } else if (key === "dataset") {
      Object.assign(node.dataset, value);
    } else if (key in node) {
      node[key] = value;
    } else {
      node.setAttribute(key, value);
    }
  }

  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(
      child instanceof Node ? child : document.createTextNode(String(child)),
    );
  }
}

export function setChildren(node, children) {
  node.replaceChildren();
  appendChildren(node, children);
}

function option(text, value = text, selected = false) {
  return new Option(text, value, false, selected);
}

export function populateSelect(selectEl, items, opts = {}) {
  const { allLabel = "All", allValue = "", selected } = opts;
  const options = [
    option(allLabel, allValue, selected === allValue),
    ...items.map((item) => option(item, item, item === selected)),
  ];
  selectEl.replaceChildren(...options);
}
