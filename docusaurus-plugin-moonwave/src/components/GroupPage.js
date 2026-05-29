// Page used for displaying `@group` summaries and their classes
import DocSidebar from "@theme/DocSidebar"
import Heading from "@theme/Heading"
import IconArrow from "@theme/Icon/Arrow"
import Layout from "@theme/Layout"
import clsx from "clsx"
import {
  default as React,
  useCallback,
  useState,
} from "react"
import Markdown from "./Markdown.js"
import { TypeLinksContext } from "./LuaClass.js"
import styles from "./styles.module.css"

const toNormal = (text) =>
  text
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")

const getClassHref = (luaClass) => `/api/${luaClass.name}`

const GroupClassList = ({ classes }) => {
  if (!classes || classes.length === 0) {
    return null
  }

  return (
    <section className={styles.summarySection}>
      <Heading as="h3">Classes</Heading>
      <div className={styles.summaryList}>
        {classes.map((luaClass) => (
          <div key={luaClass.name} className={styles.summaryRow}>
            <div className={styles.summaryRowMain}>
              <div className={styles.summaryMemberText}>
                <a href={getClassHref(luaClass)} className={styles.summaryName}>
                  <span className={styles.summaryMemberName}>
                    {toNormal(luaClass.name).map((capitalWord, index) => (
                      <span
                        key={`${capitalWord}+${index}`}
                        style={{ display: "inline-block" }}
                      >
                        {capitalWord}
                      </span>
                    ))}
                  </span>
                </a>
                {luaClass.desc && (
                  <div className={styles.summarySignature}>
                    <Markdown content={luaClass.desc} />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const GroupNode = ({ group, level = 1, showHeading = true }) => {
  const HeadingTag = `h${Math.min(level, 6)}`

  return (
    <section>
      {showHeading && <Heading as={HeadingTag}>{group.name}</Heading>}
      {group.description && <Markdown content={group.description} />}
      <GroupClassList classes={group.classes} />
      {group.children.map((child) => (
        <GroupNode key={child.slug} group={child} level={level + 1} />
      ))}
    </section>
  )
}

export default function GroupPage({ group, sidebarClassNames, typeLinks }) {
  const [hiddenSidebar, setHiddenSidebar] = useState(false)
  const toggleSidebar = useCallback(() => {
    setHiddenSidebar(!hiddenSidebar)
  }, [hiddenSidebar])

  return (
    <TypeLinksContext.Provider value={typeLinks}>
      <Layout
        title={group.label}
        description={group.description || group.label}
        wrapperClassName={clsx(styles.docPageContainer)}
      >
        <div className={clsx(styles.docPage)}>
          <div
            className={clsx(styles.docSidebarContainer, {
              [styles.docSidebarContainerHidden]: hiddenSidebar,
            })}
          >
            <DocSidebar
              path={group.slug}
              sidebar={sidebarClassNames || []}
              isHidden={hiddenSidebar}
              onCollapse={toggleSidebar}
            />
            {hiddenSidebar && (
              <div
                className={styles.collapsedDocSidebar}
                title={"Expand Sidebar"}
                aria-label={"Expand Sidebar"}
                tabIndex={0}
                role="button"
                onKeyDown={toggleSidebar}
                onClick={toggleSidebar}
              >
                <IconArrow className={styles.expandSidebarButtonIcon} />
              </div>
            )}
          </div>

          <main
            className={clsx(
              styles.docMainContainer,
              hiddenSidebar ? styles.docMainContainerEnhanced : ""
            )}
          >
            <div className={clsx("container padding-vert--lg")}>
              <div className="row">
                <div className={`col ${styles.docItemCol}`}>
                  <div className={styles.docItemContainer}>
                    <article>
                      <div className={styles.member + " markdown"}>
                        <header>
                          <h1 className={styles.docTitle}>{group.label}</h1>
                          {group.description && <Markdown content={group.description} />}
                        </header>
                        <GroupNode group={group} showHeading={false} />
                      </div>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </Layout>
    </TypeLinksContext.Provider>
  )
}
