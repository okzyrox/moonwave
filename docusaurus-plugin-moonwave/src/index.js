import { resolve } from "path"
import { existsSync } from "fs"
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
function groupSidebarItems(items, luaClassByName) {
  const result = []
  const singleGroupBuckets = new Map()
  const parentGroupBuckets = new Map()

  const pushSingleGroup = (groupName, linkItem) => {
    const bucketKey = `single:${groupName}`
    if (!singleGroupBuckets.has(bucketKey)) {
      const bucket = {
        type: "category",
        label: groupName,
        collapsible: true,
        collapsed: true,
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
      const bucket = {
        type: "category",
        label: parentName,
        collapsible: true,
        collapsed: true,
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
      const childBucket = {
        type: "category",
        label: childName,
        collapsible: true,
        collapsed: false,
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
        items: groupSidebarItems(item.items, luaClassByName),
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

    const groupedLuaClassNamesOrdered = groupSidebarItems(
      allLuaClassNamesOrdered,
      luaClassByName
    )

    const sidebarClassNames = await createData(
      "sidebar.json",
      JSON.stringify(groupedLuaClassNamesOrdered)
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

    for (const luaClass of filteredContent) {
      const apiDataPath = await createData(
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
          luaClass: apiDataPath,
          sidebarClassNames,
          typeLinks,
          tocData,
          options: pluginOptions,
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
