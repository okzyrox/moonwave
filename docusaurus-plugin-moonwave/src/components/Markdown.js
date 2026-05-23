import useDocusaurusContext from "@docusaurus/useDocusaurusContext"
import rehypePrism from "@mapbox/rehype-prism"
import { defaultSchema } from "hast-util-sanitize"
import "prism-material-themes/themes/material-default.css"
import React, { useContext } from "react"
import format from "rehype-format"
import sanitize from "rehype-sanitize"
import html from "rehype-stringify"
import directives from "remark-directive"
import remarkGfm from "remark-gfm"
import remarkRehypeAdmonitions from "../remark/remarkRehypeAdmonitions.js"
import remarkExtendedLinkReferences from "../remark/remarkExtendedLinkReferences.js"
import parse from "remark-parse"
import remark2rehype from "remark-rehype"
import { unified } from "unified"
import { TypeLinksContext } from "./LuaClass.js"

const schema = {
  ...defaultSchema,
  tagNames: [...defaultSchema.tagNames, "svg", "path"],
  attributes: {
    ...defaultSchema.attributes,
    svg: ["xmlns", "width", "height", "viewBox"],
    path: ["fill-rule", "d", "fill"],
    "*": [...defaultSchema.attributes["*"], "className"],
  },
}

const linkTransformer = (baseUrl) => (node) => {
  if (node.children) {
    node.children.forEach(linkTransformer(baseUrl))
  }

  if (node.tagName === "a") {
    const url = node.properties.href

    if (url.startsWith("http")) {
      node.properties.target = "_blank"
    } else if (url.startsWith("/")) {
      node.properties.href = baseUrl + url.slice(1)
    }
  }
}

const autoLinkReferences = (typeLinks, baseUrl) => (node) => {
  const replaceLinkRefs = (node) => {
    if (node.type === "linkReference") {
      const label = node.label.replace(/(:|\.)/, "#")
      const name = label.replace(/#.*$/, "")
      const hashMatch = label.match(/#(.+)$/)

      if (name in typeLinks) {
        let link = typeLinks[name].url

        if (link.startsWith(baseUrl)) {
          link = link.slice(baseUrl.length - 1)
        }

        node.type = "link"
        node.url = link + (hashMatch ? `#${hashMatch[1]}` : "")
        delete node.referenceType
      }
    }

    if (node.children) {
      node.children = node.children.map(replaceLinkRefs)
    }

    return node
  }

  if (node.children) {
    node.children = node.children.map(replaceLinkRefs)
  }
}

const formatKind = (kind) => {
  if (!kind) {
    return "Type"
  }

  return kind
    .replace(/\btype\b/i, "type")
    .replace(/^./, (char) => char.toUpperCase())
}

const isRobloxType = (info) => info.kind === "Roblox type"

const buildTooltipNode = (info) => ({
  type: "element",
  tagName: "span",
  properties: {
    className: ["moonwave-type-link__tooltip"],
  },
  children: [
    {
      type: "element",
      tagName: "span",
      properties: {
        className: ["moonwave-type-link__title"],
      },
      children: [{ type: "text", value: info.name }],
    },
    {
      type: "element",
      tagName: "span",
      properties: {
        className: ["moonwave-type-link__kind"],
      },
      children: [{ type: "text", value: formatKind(info.kind) }],
    },
    ...(info.desc
      ? [
          {
            type: "element",
            tagName: "span",
            properties: {
              className: ["moonwave-type-link__desc"],
            },
            children: [{ type: "text", value: info.desc }],
          },
        ]
      : []),
  ],
})

const decorateTypeLinks = (typeLinks) => (node) => {
  const replaceAnchors = (child) => {
    if (child.children) {
      child.children = child.children.map(replaceAnchors)
    }

    if (child.type !== "element" || child.tagName !== "a") {
      return child
    }

    const href = child.properties?.href

    if (!href) {
      return child
    }

    const hrefWithoutHash = href.replace(/#.*$/, "")
    const info = Object.values(typeLinks).find(
      (value) => value.url === hrefWithoutHash
    )

    if (!info || isRobloxType(info)) {
      return child
    }

    return {
      type: "element",
      tagName: "span",
      properties: {
        className: ["moonwave-type-link"],
      },
      children: [
        child,
        buildTooltipNode(info),
        {
          type: "element",
          tagName: "span",
          properties: {
            className: ["moonwave-type-link__tail"],
          },
          children: [],
        },
      ],
    }
  }

  if (node.children) {
    node.children = node.children.map(replaceAnchors)
  }
}

// Backwards compatibility for Docusaurus V2 Admonitions
function convertAdmonitions(content) {
  const blocksToConvert =
    /:::(\w+)(?:[ \t]+([^\[\]{}\n]+))?\n((?:[ \t]*\n?(?:(?!:::).)*\n?)+):::/gm

  return content.replace(blocksToConvert, (_, name, label, innerContent) => {
    label = label ? `[${label}]` : ""

    return `:::${name}${label}\n${innerContent}\n:::`
  })
}

export default function Markdown({ content, inline }) {
  const { siteConfig } = useDocusaurusContext()
  const typeLinks = useContext(TypeLinksContext)

  content = convertAdmonitions(content)

  const markdownHtml = unified()
    .use(parse)
    .use(remarkExtendedLinkReferences)
    .use(remarkGfm)
    .use(directives)
    .use(() => autoLinkReferences(typeLinks, siteConfig.baseUrl))
    .use(remark2rehype, {
      handlers: { ...remarkRehypeAdmonitions },
    })
    .use(() => linkTransformer(siteConfig.baseUrl))
    .use(() => decorateTypeLinks(typeLinks))
    .use(rehypePrism)
    .use(format)
    .use(html)
    .use(sanitize, schema)
    .processSync(content)

  const Tag = inline ? "span" : "div"

  return <Tag dangerouslySetInnerHTML={{ __html: markdownHtml }} />
}
