import { useEffect } from "react";

export default function Meta({ title, description, image }) {
    useEffect(() => {
        if (title) document.title = title;

        const setMeta = (selector, attrs, content) => {
            if (content === undefined) return;
            let el = document.querySelector(selector);
            if (!el) {
                el = document.createElement("meta");
                Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
                document.head.appendChild(el);
            }
            el.setAttribute("content", content || "");
        };

        setMeta('meta[name="description"]', { name: "description" }, description);
        setMeta('meta[property="og:title"]', { property: "og:title" }, title);
        setMeta('meta[property="og:description"]', { property: "og:description" }, description);
        setMeta('meta[property="og:image"]', { property: "og:image" }, image);
    }, [title, description, image]);

    return null;
}
