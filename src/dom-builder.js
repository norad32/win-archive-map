/**
 * @fileoverview Minimal, dependency-free DOM construction helpers.
 */

/**
 * Creates an element with the given tag, props, and children.
 * @param {string} tag Tag name, e.g. "div".
 * @param {Object<string, *>=} props Attributes/properties. Special keys:
 *   - `className` sets `.className`
 *   - `dataset` merges into `.dataset`
 *   - keys starting with "on" + a function add an event listener
 *     (e.g. `onClick`, `onInput`)
 *   - anything else is set via `setAttribute` unless it exists as a
 *     property on the element (e.g. `value`, `checked`, `disabled`),
 *     in which case the property is set directly.
 * @param {(Node|string|Array<Node|string>)=} children Child node(s) or
 *   text. Strings become text nodes (auto-escaped, never parsed as HTML).
 * @return {HTMLElement}
 */
function el(tag, props = {}, children = []) {
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

/**
 * Appends children to a node. Strings become text nodes.
 * @param {Node} node
 * @param {(Node|string|Array<Node|string>)} children
 * @return {void}
 */
function appendChildren(node, children) {
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
        if (child == null || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
}

/**
 * Replaces all children of `node` with the given children.
 * @param {Element} node
 * @param {(Node|string|Array<Node|string>)} children
 * @return {void}
 */
function setChildren(node, children) {
    node.replaceChildren();
    appendChildren(node, children);
}

/**
 * Creates an <option> element.
 * @param {string} text Visible label.
 * @param {string=} value Value attribute; defaults to `text`.
 * @param {boolean=} selected
 * @return {HTMLOptionElement}
 */
function option(text, value = text, selected = false) {
    return new Option(text, value, false, selected);
}

/**
 * Replaces all options in a <select> with an "All"/blank option followed
 * by one option per item.
 * @param {HTMLSelectElement} selectEl
 * @param {Array<string>} items
 * @param {{allLabel?: string, allValue?: string, selected?: string}=} opts
 * @return {void}
 */
function populateSelect(selectEl, items, opts = {}) {
    const { allLabel = "All", allValue = "", selected } = opts;
    const options = [
        option(allLabel, allValue, selected === allValue),
        ...items.map((item) => option(item, item, item === selected)),
    ];
    selectEl.replaceChildren(...options);
}

/**
 * Renders a list of items into a container using a render function,
 * replacing existing content.
 * @param {Element} container
 * @param {Array<*>} items
 * @param {function(*, number): Node} renderItem
 * @return {void}
 */
function renderList(container, items, renderItem) {
    container.replaceChildren(...items.map((item, i) => renderItem(item, i)));
}

/**
 * Clones a <template>'s content and lets you fill in fields by
 * selector, without ever touching innerHTML.
 * @param {HTMLTemplateElement} template
 * @param {Object<string, function(Element): void>} fillers Map of CSS
 *   selector -> function that receives the matched element and mutates
 *   it (set textContent, src, etc.).
 * @return {DocumentFragment}
 */
function cloneTemplate(template, fillers = {}) {
    const frag = template.content.cloneNode(true);
    for (const [selector, fill] of Object.entries(fillers)) {
        const target = frag.querySelector(selector);
        if (target) fill(target);
    }
    return frag;
}

export {
    el,
    appendChildren,
    setChildren,
    option,
    populateSelect,
    renderList,
    cloneTemplate,
};
