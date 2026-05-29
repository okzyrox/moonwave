import { Redirect as RouterRedirect } from "@docusaurus/router"
import React from "react"

function getSidebarItemUrl(item) {
  if (!item) {
    return null
  }

  if (item.href) {
    return item.href.replace(/^\//, "")
  }

  if (item.link?.slug) {
    return item.link.slug.replace(/^\//, "")
  }

  return null
}

function findCategory(items, label) {
  for (const item of items || []) {
    if (item?.type === "category" && item.label === label) {
      return item
    }
  }

  return null
}

// Find the first valid link in a potentially nested sidebar structure
function findFirstValidLink(items) {
  for (let index = 0; index < items.length; index++) {
    const element = items[index]

    const categoryUrl =
      element.type === "category" ? getSidebarItemUrl(element) : null

    // If the category itself has a valid URL, return it (GroupPages)
    if (categoryUrl) {
      return categoryUrl
    }

    // Skip empty categories
    if (element.type === "category" && element.items.length === 0) {
      continue
    }

    // If it's a link, return the label (class name)
    if (element.type === "link") {
      return getSidebarItemUrl(element)?.replace(/^\//, "")
    }

    // If it's a category, recursively look for the first link in its items
    if (element.type === "category") {
      const nestedLink = findFirstValidLink(element.items)
      if (nestedLink) {
        return nestedLink
      }
    }
  }

  return null // No valid link found
}

export default function Redirect({ sidebarClassNames, pluginOptions }) {
  // To prevent redirecting onto documents when clicking on the "API" tab
  // Cause otherwise it just loops back on itself
  const apiReferenceCategory = findCategory(
    sidebarClassNames,
    "API Reference" 
  )


  // Only get the first class name to redirect to from "API Reference"
  const firstLuaClassName =
    findFirstValidLink(apiReferenceCategory?.items || []) ||
    findFirstValidLink(sidebarClassNames)

  if (firstLuaClassName) {
    return <RouterRedirect to={`${pluginOptions.baseUrl}${firstLuaClassName}`} />
  }

  // No valid link found, redirect to 404
  return <RouterRedirect to={`${pluginOptions.baseUrl}api/404`} />
}
