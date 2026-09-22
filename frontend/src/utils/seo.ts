import { useEffect } from "react"

export const SITE_URL = "https://searchtern.ksaif.dev"

export interface PageMeta {
    title: string
    description: string
    path: string
    jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function upsertMeta(attr: "name" | "property", key: string, content: string) {
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
    if (!el) {
        el = document.createElement("meta")
        el.setAttribute(attr, key)
        document.head.appendChild(el)
    }
    el.setAttribute("content", content)
}

function upsertLink(rel: string, href: string) {
    let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
    if (!el) {
        el = document.createElement("link")
        el.setAttribute("rel", rel)
        document.head.appendChild(el)
    }
    el.setAttribute("href", href)
}

function upsertJsonLd(data: Record<string, unknown> | Record<string, unknown>[] | null) {
    const id = "seo-json-ld"
    document.getElementById(id)?.remove()
    if (!data) return
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.id = id
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
}

export function usePageMeta(meta: PageMeta) {
    const { title, description, path, jsonLd } = meta
    const jsonLdKey = JSON.stringify(jsonLd ?? null)
    useEffect(() => {
        const url = `${SITE_URL}${path}`
        document.title = title
        upsertMeta("name", "description", description)
        upsertLink("canonical", url)
        upsertMeta("property", "og:type", "website")
        upsertMeta("property", "og:title", title)
        upsertMeta("property", "og:description", description)
        upsertMeta("property", "og:url", url)
        upsertMeta("property", "og:image", `${SITE_URL}/favicon.png`)
        upsertMeta("name", "twitter:card", "summary")
        upsertMeta("name", "twitter:title", title)
        upsertMeta("name", "twitter:description", description)
        upsertJsonLd(jsonLd ?? null)
    }, [title, description, path, jsonLdKey])
}