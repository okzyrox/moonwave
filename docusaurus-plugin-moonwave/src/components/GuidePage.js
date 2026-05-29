// Reimplementation of the docusaurus docs pages
// SO that we can have the paginations stuff at the bottom and edit buttons
// inside the generalised sidebar
import DocSidebar from "@theme/DocSidebar"
import Link from "@docusaurus/Link"
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

export default function GuidePage({ guide, sidebarClassNames, typeLinks }) {
  const [hiddenSidebar, setHiddenSidebar] = useState(false)
  const toggleSidebar = useCallback(() => {
    setHiddenSidebar(!hiddenSidebar)
  }, [hiddenSidebar])

  return (
    <TypeLinksContext.Provider value={typeLinks}>
      <Layout
        title={guide.label}
        description={guide.label}
        wrapperClassName={clsx(styles.docPageContainer)}
      >
        <div className={clsx(styles.docPage)}>
          <div
            className={clsx(styles.docSidebarContainer, {
              [styles.docSidebarContainerHidden]: hiddenSidebar,
            })}
          >
            <DocSidebar
              path={guide.routePath}
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
            <div className={clsx("container padding-vert--lg") }>
              <div className="row">
                <div className={`col ${styles.docItemCol}`}>
                  <div className={styles.docItemContainer}>
                    <article>
                      <div className={styles.member + " markdown"}>
                        <Markdown content={guide.content} />

                        {guide.editUrl && (
                          <div style={{ marginTop: "2rem" }}>
                            <a href={guide.editUrl}>Edit this page</a>
                          </div>
                        )}

                        {(guide.previous || guide.next) && (
                          <nav
                            className="pagination-nav docusaurus-mt-lg"
                            aria-label="Guide pages"
                          >
                            {guide.previous ? (
                              <Link
                                className="pagination-nav__link pagination-nav__link--prev"
                                to={guide.previous.permalink}
                              >
                                <div className="pagination-nav__sublabel">Previous</div>
                                <div className="pagination-nav__label">{guide.previous.title}</div>
                              </Link>
                            ) : (
                              <div />
                            )}

                            {guide.next ? (
                              <Link
                                className="pagination-nav__link pagination-nav__link--next"
                                to={guide.next.permalink}
                              >
                                <div className="pagination-nav__sublabel">Next</div>
                                <div className="pagination-nav__label">{guide.next.title}</div>
                              </Link>
                            ) : (
                              <div />
                            )}
                          </nav>
                        )}
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
