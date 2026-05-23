import React from "react"
import GenericLink from "./GenericLink.js"

const isRobloxType = (kind) => kind === "Roblox type"

const formatKind = (kind) => {
  if (!kind) {
    return "Type"
  }

  return kind
    .replace(/\btype\b/i, "type")
    .replace(/^./, (char) => char.toUpperCase())
}

export default function TypeLink({ link, children, style }) {
  if (!link) {
    return children
  }

  const showTooltip = !isRobloxType(link.kind)

  const linkNode = (
    <GenericLink to={link.url} style={style}>
      {children}
    </GenericLink>
  )

  if (!showTooltip) {
    return linkNode
  }

  return (
    <span className="moonwave-type-link">
      {linkNode}
      <span className="moonwave-type-link__tooltip">
        <span className="moonwave-type-link__title">{link.name}</span>
        <span className="moonwave-type-link__kind">{formatKind(link.kind)}</span>
        {link.desc && <span className="moonwave-type-link__desc">{link.desc}</span>}
      </span>
      <span className="moonwave-type-link__tail" />
    </span>
  )
}