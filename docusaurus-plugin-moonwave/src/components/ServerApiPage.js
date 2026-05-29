// Unfinished
// In future thisll be used for displaying OpenAPI Swagger docs
// So that I can list API endpoints with my other docs on the same page
// At this point, my fork is less lua docs and more "everything" docs lol

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

const OperationSection = ({ operation }) => (
  <section>
    <Heading as="h2" id={operation.anchor}>
      {operation.title}
    </Heading>
    <div className={styles.memberString}>
      <code>{operation.method}</code> <code>{operation.path}</code>
    </div>
    {operation.description && <Markdown content={operation.description} />}
  </section>
)

export default function ServerApiPage({ api, sidebarClassNames, typeLinks }) {
  const [hiddenSidebar, setHiddenSidebar] = useState(false)
  const toggleSidebar = useCallback(() => {
    setHiddenSidebar(!hiddenSidebar)
  }, [hiddenSidebar])

  return (
    <TypeLinksContext.Provider value={typeLinks}>
      <Layout
        title={api.label}
        description={api.label}
        wrapperClassName={clsx(styles.docPageContainer)}
      >
        <div className={clsx(styles.docPage)}>
          <div
            className={clsx(styles.docSidebarContainer, {
              [styles.docSidebarContainerHidden]: hiddenSidebar,
            })}
          >
            <DocSidebar
              path={api.routePath}
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
                          <h1 className={styles.docTitle}>{api.label}</h1>
                        </header>
                        {api.operations.map((operation) => (
                          <OperationSection
                            key={operation.anchor}
                            operation={operation}
                          />
                        ))}
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
