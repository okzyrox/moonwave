import { resolve, relative, sep } from "path"
import { existsSync, readdirSync, readFileSync } from "fs"
import { promisify } from "util"
const exec = promisify(require("child_process").exec)
import { generateRobloxTypes } from "./generateRobloxTypes.js"

const capitalize = (text) => text[0].toUpperCase() + text.substring(1)

const breakCapitalWordsZeroWidth = (text) =>
  text.replace(/([A-Z])/g, "\u200B$1") // Adds a zero-width space before each capital letter. This way, the css word-break: break-word; rule can apply correctly

const normalizeSectionName = (text) =>
  text
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map(capitalize)
    .join(" ")

const getGroupPath = (luaClass) => {
  if (!luaClass?.group) {
    return []
  }

  const path = []

  if (luaClass.group.parent) {
    path.push(luaClass.group.parent)
  }

  path.push(luaClass.group.name)

  return path
}
const getGroupUrlKey = (groupPath) => groupPath.join("\u0000")
const getGroupPageUrl = (groupPath) => `/api/groups/${groupPath.map((segment) => encodeURIComponent(segment)).join("/")}`
const getGroupSidebarUrl = (groupPath, groupIndex) => {
  const groupNode = groupIndex.get(getGroupUrlKey(groupPath))

  if (!groupNode) {
    return undefined
  }

  return groupNode.slug
}

const toNormalTitle = (text) =>
  text
    .replace(/([A-Z])/g, " $1")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase())

const toGuideRouteUrl = (projectDir, filePath) => {
  const docsRootDir = resolve(projectDir, "docs")
  const relPath = relative(docsRootDir, filePath)
  const noExt = relPath.replace(/\.(mdx?)$/, "")
  const normalized = noExt
    .split(sep)
    .map((segment) => encodeURIComponent(segment))
    .join("/")

  return `/api/guide/${normalized.replace(/\/index$/, "")}`.replace(/\/index$/, "")
}

const toServerApiRoutePath = (projectDir, filePath) => {
  const docsRootDir = resolve(projectDir, "docs")
  const relPath = relative(docsRootDir, filePath).replace(/\.openapi\.json$/, "")
  const segments = relPath.split(sep).filter(Boolean)
  return `/api/server/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`
}

const getEndpointAnchor = (method, endpointPath) =>
  `${method}-${endpointPath}`
    .toLowerCase()
    .replace(/\{([^}]+)\}/g, "$1")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

const listFiles = (dirPath) => {
  if (!existsSync(dirPath)) {
    return []
  }

  return readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = resolve(dirPath, entry.name)
    if (entry.isDirectory()) {
      return listFiles(fullPath)
    }
    return [fullPath]
  })
}

const splitFrontmatter = (rawText) => {
  const frontmatterMatch = rawText.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/) 

  if (!frontmatterMatch) {
    return { body: rawText, frontmatter: {} }
  }

  const frontmatter = {}
  frontmatterMatch[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const separatorIndex = line.indexOf(":")
      if (separatorIndex < 0) {
        return
      }

      const key = line.slice(0, separatorIndex).trim()
      const value = line.slice(separatorIndex + 1).trim()
      frontmatter[key] = value
    })

  return {
    frontmatter,
    body: rawText.slice(frontmatterMatch[0].length),
  }
}

const getFirstMarkdownHeading = (content) => {
  const headingMatch = content.match(/^\s*#\s+(.+)$/m)
  if (!headingMatch) {
    return undefined
  }

  return headingMatch[1]
    .replace(/`+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .trim()
}

const toHeadingLabel = (rawHeading) =>
  rawHeading
    .replace(/`+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .trim()

const toHeadingUrl = (heading, usedSlugs) => {
  const baseSlug = toHeadingLabel(heading)
    .toLowerCase()
    .replace(/["'`]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")

  const mainSlug = baseSlug || "section"
  const occurrence = usedSlugs.get(mainSlug) || 0
  usedSlugs.set(mainSlug, occurrence + 1)

  return occurrence === 0 ? mainSlug : `${mainSlug}-${occurrence}`
}

const getSubheadings = (content) => {
  const headings = []
  const usedSlugs = new Map()
  let inFence = false

  content.split(/\r?\n/).forEach((line) => {
    if (/^```/.test(line.trim())) {
      inFence = !inFence
      return
    }

    if (inFence) {
      return
    }

    const heading = line.match(/^\s*(#{2,6})\s+(.+)$/)
    if (!heading) {
      return
    }

    const label = toHeadingLabel(heading[2])
    if (!label) {
      return
    }

    headings.push({
      label,
      level: heading[1].length,
      anchor: toHeadingUrl(label, usedSlugs),
    })
  })

  return headings
}

const parseGuideEntry = (projectDir, filePath) => {
  const docsRootDir = resolve(projectDir, "docs")
  const relativePath = relative(docsRootDir, filePath)
  const raw = readFileSync(filePath, "utf8")
  const { frontmatter, body } = splitFrontmatter(raw)

  const parsedPosition = Number(frontmatter.sidebar_position)
  const sidebarPosition = Number.isFinite(parsedPosition)
    ? parsedPosition
    : Number.POSITIVE_INFINITY

  const fallbackLabel = toNormalTitle(relativePath.replace(/\.(mdx?)$/, ""))
  const headingLabel = getFirstMarkdownHeading(body)
  const label = headingLabel || fallbackLabel

  return {
    filePath,
    relativePath,
    routePath: toGuideRouteUrl(projectDir, filePath),
    label,
    content: body,
    headings: getSubheadings(body),
    sidebarPosition,
  }
}

const buildGuideEntries = (projectDir) => {
  const docsRootDir = resolve(projectDir, "docs")
  if (!existsSync(docsRootDir)) {
    return []
  }

  return listFiles(docsRootDir)
    .filter((filePath) => /\.(mdx?)$/.test(filePath))
    .filter((filePath) => !filePath.endsWith(".openapi.json"))
    .map((filePath) => parseGuideEntry(projectDir, filePath))
    .sort((left, right) => {
      if (left.sidebarPosition !== right.sidebarPosition) {
        return left.sidebarPosition - right.sidebarPosition
      }

      return left.label.localeCompare(right.label)
    })
}

const buildServerApiEntries = (projectDir) => {
  const docsRootDir = resolve(projectDir, "docs")
  if (!existsSync(docsRootDir)) {
    return []
  }

  return listFiles(docsRootDir)
    
    .filter((filePath) => filePath.endsWith(".openapi.json"))
    .map((filePath) => {
      const raw = JSON.parse(readFileSync(filePath, "utf8"))
      if (!raw.openapi) {
        throw new Error(
          `Moonwave: ${relative(projectDir, filePath)} must be a valid OpenAPI Swagger document`
        )
      }

      const operations = [] // TODO: Parse.
      // Need to decide how I want it to look
      // Although Id probably display the name of the operation alongside the method in the sidebar
      const routePath = toServerApiRoutePath(projectDir, filePath)
      const label = toNormalTitle(
        relative(docsRootDir, filePath).replace(/\.openapi\.json$/, "")
      )

      return {
        filePath,
        label,
        routePath,
        operations: operations.sort((left, right) =>
          left.title.localeCompare(right.title)
        ),
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
}

const getFunctionCallOperator = (type) =>
  type === "static" ? "." : type === "method" ? ":" : ""

const mapLinksByName = (nameSet, items) =>
  items.map((name) => {
    if (!nameSet.has(name)) {
      throw new Error(
        `Moonwave plugin: "${name}" listed in classOrder option does not exist`
      )
    }

    return {
      type: "link",
      href: `/api/${name}`,
      label: breakCapitalWordsZeroWidth(name),
    }
  })

function flattenTOC(toc) {
  const flat = []

  const iterate = (list) => {
    for (const item of list) {
      flat.push({
        ...item,
        children: undefined,
      })

      if (item.children) {
        iterate(item.children)
      }
    }
  }

  iterate(toc)

  return flat
}

function parseSimpleClassOrder(content, classOrder, nameSet) {
  const listedLinks = mapLinksByName(nameSet, classOrder)

  const unlistedLinks = content
    .map((luaClass) => luaClass.name)
    .filter((name) => !classOrder.includes(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      type: "link",
      href: `/api/${name}`,
      label: breakCapitalWordsZeroWidth(name),
    }))

  return [...listedLinks, ...unlistedLinks]
}

function parseSectionalClassOrder(content, classOrder, filteredContent) {
  const nameSet = new Set()
  filteredContent.forEach((luaClass) => nameSet.add(luaClass.name))

  const listedNames = []
  const listedSidebar = []

  classOrder.forEach((element) => {
    if (element.items && Array.isArray(element.items)) {
      // Handle both direct classes and nested items
      const directClasses = element.classes || []
      const directClassItems = mapLinksByName(nameSet, directClasses)

      const childItems = processNestedItems(
        element.items,
        nameSet,
        filteredContent,
        listedNames
      )

      // Combine direct classes with nested items
      const allItems = [...directClassItems, ...childItems]

      listedSidebar.push({
        type: "category",
        label: element.section,
        collapsible: true,
        collapsed: element.collapsed ?? true,
        items: allItems,
      })

      // Add direct classes to listed names
      listedNames.push(...directClasses)
    } else {
      // Handle sections without nested items (existing logic)
      const namesWithTags = filteredContent
        .filter((luaClass) =>
          luaClass.tags ? luaClass.tags.includes(element.tag) : false
        )
        .map((luaClass) => luaClass.name)
      const namesIncludedInClasses = element.classes || []

      const tagsItems = mapLinksByName(nameSet, namesWithTags)
      const classesItems = mapLinksByName(nameSet, namesIncludedInClasses)

      if (element.section) {
        listedSidebar.push({
          type: "category",
          label: element.section,
          collapsible: true,
          collapsed: element.collapsed ?? true,
          items: [...classesItems, ...tagsItems],
        })
      } else {
        const toPush = [...classesItems, ...tagsItems]
        listedSidebar.push(...toPush)
      }

      const toPush = [...namesWithTags, ...namesIncludedInClasses]
      listedNames.push(...toPush)
    }
  })

  const unlistedSidebar = content
    .map((luaClass) => luaClass.name)
    .filter((name) => !listedNames.includes(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      type: "link",
      href: `/api/${name}`,
      label: breakCapitalWordsZeroWidth(name),
    }))

  return [...listedSidebar, ...unlistedSidebar]
}

function parseClassOrder(content, classOrder, filteredContent) {
  const nameSet = new Set()
  filteredContent.forEach((luaClass) => nameSet.add(luaClass.name))
  if (classOrder.length === 0) {
    return [...nameSet].sort().map((name) => ({
      type: "link",
      href: `/api/${name}`,
      label: breakCapitalWordsZeroWidth(name),
    }))
  }

  if (typeof classOrder[0] === "string") {
    // Handles simple classOrder array assignment
    return parseSimpleClassOrder(content, classOrder, nameSet)
  } else {
    // Handles cases where classOrder is assigned via TOML tables
    return parseSectionalClassOrder(content, classOrder, filteredContent)
  }
}

function processNestedItems(items, nameSet, filteredContent, listedNames) {
  const result = []

  items.forEach((item) => {
    // If item has a nested section
    if (item.section) {
      const childItems = []

      // Handle classes directly under this section
      if (item.classes && Array.isArray(item.classes)) {
        const classesItems = mapLinksByName(nameSet, item.classes)
        childItems.push(...classesItems)
        listedNames.push(...item.classes)
      }

      // Handle tagged classes
      if (item.tag) {
        const namesWithTags = filteredContent
          .filter((luaClass) =>
            luaClass.tags ? luaClass.tags.includes(item.tag) : false
          )
          .map((luaClass) => luaClass.name)

        const tagsItems = mapLinksByName(nameSet, namesWithTags)
        childItems.push(...tagsItems)
        listedNames.push(...namesWithTags)
      }

      // Handle further nested items recursively
      if (item.items && Array.isArray(item.items)) {
        const nestedItems = processNestedItems(
          item.items,
          nameSet,
          filteredContent,
          listedNames
        )
        childItems.push(...nestedItems)
      }

      // Add this section to the result
      result.push({
        type: "category",
        label: item.section,
        collapsible: true,
        collapsed: item.collapsed ?? true,
        items: childItems,
      })
    }
    // If item just has classes (no section)
    else if (item.classes && Array.isArray(item.classes)) {
      const classesItems = mapLinksByName(nameSet, item.classes)
      result.push(...classesItems)
      listedNames.push(...item.classes)
    }
  })

  return result
}

// A bit messy...
function groupSidebarItems(items, luaClassByName, groupIndex) {
  const result = []
  const singleGroupBuckets = new Map()
  const parentGroupBuckets = new Map()

  const pushSingleGroup = (groupName, linkItem) => {
    const bucketKey = `single:${groupName}`
    if (!singleGroupBuckets.has(bucketKey)) {
      const groupPath = [groupName]
      const bucket = {
        type: "category",
        label: groupName,
        collapsible: true,
        collapsed: true,
        href: getGroupSidebarUrl(groupPath, groupIndex),
        className: "moonwave-group-category moonwave-group-category--single",
        items: [],
      }

      singleGroupBuckets.set(bucketKey, bucket)
      result.push(bucket)
    }

    singleGroupBuckets.get(bucketKey).items.push(linkItem)
  }

  const pushNestedGroup = (parentName, childName, linkItem) => {
    const parentKey = `parent:${parentName}`

    if (!parentGroupBuckets.has(parentKey)) {
      const parentPath = [parentName]
      const bucket = {
        type: "category",
        label: parentName,
        collapsible: true,
        collapsed: true,
        href: getGroupSidebarUrl(parentPath, groupIndex),
        className: "moonwave-group-category moonwave-group-category--parent",
        items: [],
      }

      parentGroupBuckets.set(parentKey, bucket)
      result.push(bucket)
    }

    const parentBucket = parentGroupBuckets.get(parentKey)
    const childKey = `${parentKey}:${childName}`
    if (!parentBucket.__childBuckets) {
      parentBucket.__childBuckets = new Map()
    }

    if (!parentBucket.__childBuckets.has(childKey)) {
      const childPath = [parentName, childName]
      const childBucket = {
        type: "category",
        label: childName,
        collapsible: true,
        collapsed: false,
        href: getGroupSidebarUrl(childPath, groupIndex),
        className: "moonwave-group-category moonwave-group-category--child",
        items: [],
      }

      parentBucket.__childBuckets.set(childKey, childBucket)
      parentBucket.items.push(childBucket)
    }

    parentBucket.__childBuckets.get(childKey).items.push(linkItem)
  }

  items.forEach((item) => {
    if (item.type === "category" && item.items) {
      result.push({
        ...item,
        items: groupSidebarItems(item.items, luaClassByName, groupIndex),
      })
      return
    }

    if (item.type !== "link" || !item.href?.startsWith("/api/")) {
      result.push(item)
      return
    }

    const className = item.href.slice("/api/".length)
    const groupPath = getGroupPath(luaClassByName.get(className))

    if (groupPath.length === 0) {
      // Ungrouped
      result.push(item)
      return
    }

    if (groupPath.length === 1) {
      // Single level group
      pushSingleGroup(groupPath[0], item)
      return
    }

    pushNestedGroup(groupPath[0], groupPath[1], item)
  })

  return result.map((item) => {
    if (!item.__childBuckets) {
      return item
    }

    const { __childBuckets, ...rest } = item
    return rest
  })
}

function parseApiCategories(luaClass, apiCategories) {
  const tocData = []

  // Loop through each member type of a LuaClass and check if it has any tagged children. If the tags match any tag provided by the user with the apiCategories config option, add it to it's own subheading in the table of contents
  const SECTIONS = ["types", "properties", "functions"]
  SECTIONS.forEach((section) => {
    const tagSet = new Set(
      luaClass[section]
        .filter((member) => !member.ignore)
        .filter((member) => member.tags)
        .flatMap((member) => member.tags)
    )

    const sectionChildren = []

    for (const category of apiCategories) {
      if (!tagSet.has(category)) {
        continue
      }

      const apiCategoryChild = []

      apiCategoryChild.push({
        value: capitalize(category),
        id: category,
        level: 3,
        children: luaClass[section]
          .filter((member) => !member.ignore)
          .filter((member) => member.tags && member.tags.includes(category))
          .map((member) => {
            return {
              value:
                member.name === "__call"
                  ? luaClass.name + "()"
                  : getFunctionCallOperator(member.function_type) + member.name,
              id: member.name,
              children: [],
              level: 4,
              private: member.private,
            }
          })
          .sort((childA, childB) => childA.value.localeCompare(childB.value)),
      })

      sectionChildren.push(...apiCategoryChild)
    }

    const baseCategories = luaClass[section]
      .filter((member) => !member.ignore)
      .filter(
        (member) =>
          !member.tags ||
          !member.tags.some((tag) => apiCategories.includes(tag))
      )
      .map((member) => ({
        value:
          member.name === "__call"
            ? luaClass.name + "()"
            : getFunctionCallOperator(member.function_type) + member.name,
        id: member.name,
        children: [],
        level: 3,
        private: member.private,
      }))
      .sort((childA, childB) => childA.value.localeCompare(childB.value))

    sectionChildren.push(...baseCategories)

    tocData.push({
      value: capitalize(section),
      id: section,
      children: sectionChildren,
      level: 2,
    })
  })

  return [...tocData]
}

async function generateTypeLinks(luaClasses, baseUrl) {
  const robloxTypes = await generateRobloxTypes()

  const typeLinks = {}

  Object.entries(robloxTypes).forEach(([name, url]) => {
    typeLinks[name] = {
      url,
      name,
      kind: "Roblox type",
    }
  })

  luaClasses.forEach((luaClass) => {
    typeLinks[luaClass.name] = {
      url: `${baseUrl}api/${luaClass.name}`,
      name: luaClass.name,
      kind: "class",
      desc: luaClass.desc,
    }

    luaClass.types.forEach((type) => {
      typeLinks[type.name] = {
        url: `${baseUrl}api/${luaClass.name}#${type.name}`,
        name: type.name,
        kind: type.lua_type ? "type" : "interface",
        desc: type.desc,
      }
    })

    const entries = [
      luaClass,
      ...luaClass.functions,
      ...luaClass.properties,
      ...luaClass.types,
    ]

    entries
      .filter(
        (entry) => entry.external_types && entry.external_types.length > 0
      )
      .forEach((entry) => {
        entry.external_types.forEach((type) => {
          typeLinks[type.name] = {
            url: type.url,
            name: type.name,
            kind: "external type",
          }
        })
      })
  })

  return typeLinks
}

// Groups listing
function buildGroupTree(luaClasses) {
  // Might not be the fastest
  // Maybe the extractor could build this ahead of time
  // Although I hate rust so
  // No... 
  const tempGroups = new Map()
  const groupIndex = new Map()

  const ensureNode = (groupPath) => {
    let currentMap = tempGroups
    let currentItem = null

    groupPath.forEach((groupName, index) => {
      const currentPath = groupPath.slice(0, index + 1)
      const pathKey = getGroupUrlKey(currentPath)

      if (!currentMap.has(pathKey)) {
        const node = {
          name: groupName,
          label: groupName,
          path: currentPath,
          slug: getGroupPageUrl(currentPath),
          description: "",
          descriptionSource: null,
          classes: [],
          children: new Map(),
        }

        currentMap.set(pathKey, node)
      }

      currentItem = currentMap.get(pathKey)
      currentMap = currentItem.children
    })

    return currentItem
  }

  for (const luaClass of luaClasses) {
    const groupPath = getGroupPath(luaClass)

    if (groupPath.length === 0) {
      continue
    }

    const groupNode = ensureNode(groupPath)
    groupNode.classes.push(luaClass)

    // Ideally should be done in the extractor
    if (luaClass.groupDescription) {
      if (
        groupNode.descriptionSource &&
        groupNode.descriptionSource !== luaClass.name
      ) {
        throw new Error(
          `Moonwave: cannot use @groupdescription more than once`
        )
      }

      groupNode.description = luaClass.desc
      groupNode.descriptionSource = luaClass.name
    }
  }

  const sortGroup = (node) => {
    const children = [...node.children.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(sortGroup)

    const sortedNode = {
      name: node.name,
      label: node.label,
      path: node.path,
      slug: node.slug,
      description: node.description,
      descriptionSource: node.descriptionSource,
      classes: [...node.classes].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
      children,
    }

    groupIndex.set(getGroupUrlKey(sortedNode.path), sortedNode)

    return sortedNode
  }

  const groups = [...tempGroups.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(sortGroup)

  return { groups, groupIndex }
}

function validateNestedItems(items, path) {
  items.forEach((item, index) => {
    const currentPath = `${path}[${index}]`

    // Validate section name
    if (item.section && typeof item.section !== "string") {
      throw new Error(
        `Moonwave plugin: expected ${currentPath}.section to be a string.`
      )
    }

    // Validate classes array
    if (item.classes !== undefined) {
      if (!Array.isArray(item.classes)) {
        throw new Error(
          `Moonwave plugin: expected ${currentPath}.classes to be an array.`
        )
      }

      item.classes.forEach((className, classIndex) => {
        if (typeof className !== "string") {
          throw new Error(
            `Moonwave plugin: expected ${currentPath}.classes[${classIndex}] to be a string.`
          )
        }
      })
    }

    // Validate tag
    if (item.tag !== undefined && typeof item.tag !== "string") {
      throw new Error(
        `Moonwave plugin: expected ${currentPath}.tag to be a string.`
      )
    }

    // Recursively validate nested items
    if (item.items !== undefined) {
      if (!Array.isArray(item.items)) {
        throw new Error(
          `Moonwave plugin: expected ${currentPath}.items to be an array.`
        )
      }

      validateNestedItems(item.items, `${currentPath}.items`)
    }
  })
}

export default (context, options) => ({
  name: "docusaurus-plugin-moonwave",

  getThemePath() {
    return resolve(__dirname, "./theme")
  },

  getPathsToWatch() {
    return options.code.map((filePath) => `${filePath}/**/*.{lua,luau}`)
  },

  async loadContent() {
    const basePath = options.projectDir || resolve(process.cwd(), "..")

    const binaryPath = options.binaryPath ?? "moonwave-extractor"

    const api = await Promise.all(
      options.code.map((root) =>
        exec(
          `"${binaryPath}" extract "${root.replace(
            /\\/g,
            "/"
          )}" --base "${basePath}"`,
          {
            maxBuffer: 10 * 1024 * 1024,
          }
        )
          .then(({ stdout, stderr }) => {
            if (stderr.length > 0) {
              return Promise.reject(stderr)
            }

            return stdout
          })
          .catch(({ stderr }) => {
            console.error(`\n${stderr}`)
            return Promise.reject(`Moonwave: Failed to extract. Check the error above.`)
          })
          .then((raw) => JSON.parse(raw))
      )
    )

    return api.flat()
  },

  async contentLoaded({ content, actions: { addRoute, createData } }) {
    const basePath = options.projectDir || resolve(process.cwd(), "..")
    const filteredContent = content.filter((luaClass) => !luaClass.ignore)

    filteredContent.sort((a, b) => {
      if (a.name < b.name) {
        return -1
      } else if (a.name > b.name) {
        return 1
      } else {
        return 0
      }
    })

    const nameSet = new Set()
    filteredContent.forEach((luaClass) => nameSet.add(luaClass.name))

    const classOrder = options.classOrder

    if (options.autoSectionPath) {
      if (
        classOrder.length > 0 &&
        !classOrder.every((item) => typeof item === "object")
      ) {
        throw new Error(
          "When using autoSectionPath, classOrder cannot contain bare string keys." +
            "Use sectional style instead: https://eryn.io/moonwave/docs/Configuration#sections"
        )
      }

      const prefix = options.autoSectionPath

      for (const luaClass of filteredContent) {
        if (luaClass.source.path.startsWith(prefix)) {
          const classPath = luaClass.source.path.slice(prefix.length + 1)

          const nextDirMatch = classPath.match(/^(.+?)\//)

          if (nextDirMatch) {
            const nextDir = nextDirMatch[1]

            // convert kebab-case, snake_case, camelCase, PascalCase to Title Case
            const title = normalizeSectionName(nextDir)

            const existingSection = classOrder.find(
              (section) => section.section === title
            )

            if (existingSection) {
              // avoid duplicating classes
              if (!existingSection.classes.includes(luaClass.name)) {
                existingSection.classes.push(luaClass.name)
              }
            } else {
              classOrder.push({
                section: title,
                classes: [luaClass.name],
              })
            }
          }
        }
      }
    }

    const allLuaClassNamesOrdered = parseClassOrder(
      filteredContent,
      classOrder,
      filteredContent
    )

    const luaClassByName = new Map(
      filteredContent.map((luaClass) => [luaClass.name, luaClass])
    )

    // for better sidebar grouping consistency
    const { groups: groupTrees, groupIndex } = buildGroupTree(filteredContent)

    const groupedClassNames = groupSidebarItems(
      allLuaClassNamesOrdered,
      luaClassByName,
      groupIndex
    )

    const guideEntries = buildGuideEntries(basePath)
    const serverApiEntries = buildServerApiEntries(basePath)

    // A bit rough..
    // Maybe i'd make it configurable via the config file or something
    // Although idk how i'd structure it without just hardcoding like so
    const apiReferenceSection = {
      type: "category",
      label: "API Reference",
      className: "moonwave-section-header",
      collapsible: true,
      collapsed: false,
      items: groupedClassNames,
    }

    const serverApiSection = {
      type: "category",
      label: "Server APIs",
      className: "moonwave-section-header",
      collapsible: true,
      collapsed: true,
      items: serverApiEntries.map((entry) => ({
        type: "category",
        label: entry.label,
        collapsible: true,
        collapsed: true,
        href: entry.routePath,
        items: entry.operations.map((operation) => ({
          type: "link",
          href: `${entry.routePath}#${operation.anchor}`,
          label: operation.title,
        })),
      })),
    }

    const sidebarEntries = [
      {
        type: "category",
        label: "Guide",
        className: "moonwave-section-header",
        collapsible: true,
        collapsed: false,
        items: guideEntries.map((entry) =>
          entry.headings.length > 0
            ? { // scuffed
                type: "category",
                label: entry.label,
                collapsible: true,
                collapsed: true,
                href: entry.routePath,
                items: entry.headings.map((heading) => ({
                  type: "link",
                  href: `${entry.routePath}#${heading.anchor}`,
                  label: heading.label,
                })),
              }
            : {
                type: "link",
                href: entry.routePath,
                label: entry.label,
              }
        ),
      },
      apiReferenceSection,
      serverApiSection,
    ]

    const sidebarClassNames = await createData(
      "sidebar.json",
      JSON.stringify(sidebarEntries)
    )

    const apiCategories = options.apiCategories
    const baseUrl = context.baseUrl
    const pluginOptions = await createData(
      "options.json",
      JSON.stringify({
        sourceUrl: options.sourceUrl,
        baseUrl: baseUrl,
        classOrder: classOrder,
        apiCategories: apiCategories,
      })
    )

    const typeLinksData = await generateTypeLinks(
      filteredContent,
      baseUrl
    )
    const typeLinks = await createData(
      "typeLinks.json",
      JSON.stringify(typeLinksData)
    )

    addRoute({
      path: baseUrl + "api/",
      exact: true,
      component: resolve(__dirname, "components/Redirect.js"),
      modules: {
        sidebarClassNames,
        pluginOptions,
      },
    })

    for (const entry of guideEntries) {
      const entryIndex = guideEntries.findIndex(
        (guideEntry) => guideEntry.routePath === entry.routePath
      )

      const previous =
        entryIndex > 0
          ? {
              title: guideEntries[entryIndex - 1].label,
              permalink: guideEntries[entryIndex - 1].routePath,
            }
          : null

      const next =
        entryIndex < guideEntries.length - 1
          ? {
              title: guideEntries[entryIndex + 1].label,
              permalink: guideEntries[entryIndex + 1].routePath,
            }
          : null

      const sourceUrl = options.sourceUrl?.replace(/\/$/, "")
      // remaking `docs` entries urls into the apis entries
      // so that they can be on the same plage...
      const guideDataUrl = await createData(
        `guide-${entry.relativePath
          .replace(/\\/g, "-")
          .replace(/\.(mdx?)$/, "")
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase()}.json`,
        JSON.stringify({
          ...entry,
          previous,
          next,
          editUrl: sourceUrl
            ? `${sourceUrl}/docs/${entry.relativePath.replace(/\\/g, "/")}`
            : null,
        })
      )

      addRoute({
        path: `${baseUrl}${entry.routePath.slice(1)}`,
        component: resolve(__dirname, "components/GuidePage.js"),
        modules: {
          guide: guideDataUrl,
          sidebarClassNames,
          typeLinks,
        },
        exact: true,
      })
    }

    for (const luaClass of filteredContent) {
      const apiDataUrl = await createData(
        `${luaClass.name}.json`,
        JSON.stringify(luaClass)
      )

      const tocDataOrdered = parseApiCategories(luaClass, apiCategories).filter(
        (element) => element.children.length > 0
      )

      const tocData = await createData(
        `${luaClass.name}-toc.json`,
        JSON.stringify(flattenTOC(tocDataOrdered))
      )

      console.log(`Adding path /api/${luaClass.name}`)

      addRoute({
        path: `${baseUrl}api/${luaClass.name}`,
        component: resolve(__dirname, "components/LuaClass.js"),
        modules: {
          luaClass: apiDataUrl,
          sidebarClassNames,
          typeLinks,
          tocData,
          options: pluginOptions,
        },
        exact: true,
      })
    }

    const updateGroupsPages = async (groupNodes) => {
      for (const groupNode of groupNodes) {
        const groupDataPath = await createData(
          `group-${groupNode.path.map((segment) => encodeURIComponent(segment)).join("__")}.json`,
          JSON.stringify(groupNode)
        )
        // seems to break groups with spaces in their names
        // would recommend just using a `-` in place

        addRoute({
          path: `${baseUrl}${groupNode.slug.slice(1)}`,
          component: resolve(__dirname, "components/GroupPage.js"),
          modules: {
            group: groupDataPath,
            sidebarClassNames,
            typeLinks,
          },
          exact: true,
        })

        if (groupNode.children.length > 0) {
          await updateGroupsPages(groupNode.children)
        }
      }
    }

    await updateGroupsPages(groupTrees)

    for (const entry of serverApiEntries) {
      const apiDataUrl = await createData(
        `server-api-${relative(projectDir, entry.filePath)
          .replace(/\\/g, "-")
          .replace(/\.openapi\.json$/, "")
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase()}.json`,
        JSON.stringify(entry)
      )

      addRoute({
        path: `${baseUrl}${entry.routePath.slice(1)}`,
        component: resolve(__dirname, "components/ServerApiPage.js"),
        modules: {
          api: apiDataUrl,
          sidebarClassNames,
          typeLinks,
        },
        exact: true,
      })
    }
  },
})

export function validateOptions({ options }) {
  if (!options.code) {
    throw new Error(
      "Moonwave plugin: expected option `code` to point to your source code."
    )
  }

  if (options.sourceUrl && typeof options.sourceUrl !== "string") {
    throw new Error(
      "Moonwave plugin: expected option `sourceUrl` to be a string."
    )
  }

  if (options.projectDir && typeof options.projectDir !== "string") {
    throw new Error(
      "Moonwave plugin: expected option `projectDir` to be a string."
    )
  }

  if (options.classOrder && Array.isArray(options.classOrder)) {
    options.classOrder.forEach((section, index) => {
      // If there are nested items
      if (section.items && Array.isArray(section.items)) {
        validateNestedItems(section.items, `classOrder[${index}].items`)
      }
    })
  }

  if (!Array.isArray(options.code)) {
    options.code = [options.code]
  }

  for (const [index, codePath] of options.code.entries()) {
    if (typeof codePath !== "string") {
      throw new Error(
        `Moonwave plugin: code should be an array of strings, found a: ${typeof codePath}`
      )
    }

    const resolvedPath = resolve(process.cwd(), codePath)

    if (!existsSync(resolvedPath)) {
      throw new Error(
        `Moonwave plugin: code path ${resolvedPath} does not actually exist.`
      )
    }

    options.code[index] = resolvedPath
  }

  return options
}
