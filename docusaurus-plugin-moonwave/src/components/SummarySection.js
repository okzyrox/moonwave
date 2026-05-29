// SummarySection
/// A summary of a class alike to roblox's documentation with functions, properties and events.

import Heading from "@theme/Heading"
import React from "react"
import Badge from "./Badge.js"
import LuaType from "./LuaType.js"
import styles from "./styles.module.css"

const PropertyIcon = () => (
  <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M4.89453 9.38443V15.4702C4.89453 16.0225 5.34225 16.4702 5.89453 16.4702H11.9803C12.3781 16.4702 12.7597 16.3122 13.041 16.0309L15.4552 13.6167C15.7365 13.3354 15.8945 12.9538 15.8945 12.556V6.97021C15.8945 6.14179 15.223 5.47021 14.3945 5.47021H8.80874C8.41092 5.47021 8.02939 5.62825 7.74808 5.90955L5.33387 8.32377C5.05257 8.60507 4.89453 8.9866 4.89453 9.38443ZM8.80874 6.47021C8.67614 6.47021 8.54896 6.52289 8.45519 6.61666L6.60164 8.47021H11.8945C11.9841 8.47021 12.0709 8.48199 12.1536 8.50409L14.1874 6.47021H8.80874ZM14.8945 7.17732L12.8607 9.21119C12.8828 9.29381 12.8945 9.38064 12.8945 9.47021V14.7631L14.7481 12.9096C14.8419 12.8158 14.8945 12.6886 14.8945 12.556V7.17732Z" fill="#1AC8FF"></path>
  </svg>
)

const FunctionIcon = () => (
  <svg width="25" height="25" viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#:rg9:)">
      <path d="M14.7149 7.74818C14.4095 7.57548 14.0359 7.57548 13.7304 7.74818L9.98044 9.86867C9.89177 9.91881 9.81266 9.98134 9.7448 10.0534L14.2228 12.4053L18.7063 10.0596C18.6372 9.98493 18.5561 9.92025 18.4649 9.86867L14.7149 7.74818Z" fill="#E26CF4"></path>
      <path d="M18.9727 11.0488L14.7222 13.2726V17.9312L18.4649 15.8148C18.7787 15.6374 18.9727 15.3048 18.9727 14.9444V11.0488Z" fill="#E26CF4"></path><path d="M9.47266 11.04L13.7222 13.2719V17.9307L9.98044 15.8148C9.66666 15.6374 9.47266 15.3048 9.47266 14.9444V11.04Z" fill="#E26CF4"></path>
      <path d="M8.72266 9.21985C8.85025 9.21985 8.9704 9.25171 9.07559 9.30792C8.6996 9.67497 8.47792 10.1812 8.47275 10.7198H6.22266C5.80844 10.7198 5.47266 10.3841 5.47266 9.96985C5.47266 9.55564 5.80844 9.21985 6.22266 9.21985H8.72266Z" fill="#E26CF4"></path>
      <path d="M8.22266 11.9796C8.31032 11.9796 8.39446 11.9947 8.47266 12.0223V13.4369C8.39446 13.4646 8.31032 13.4796 8.22266 13.4796H4.72266C4.30844 13.4796 3.97266 13.1438 3.97266 12.7296C3.97266 12.3154 4.30844 11.9796 4.72266 11.9796H8.22266Z" fill="#E26CF4"></path>
      <path d="M6.22266 14.7296H8.47266V14.9444C8.47266 15.4104 8.63476 15.853 8.91887 16.2037C8.85633 16.2206 8.79055 16.2296 8.72266 16.2296H6.22266C5.80844 16.2296 5.47266 15.8938 5.47266 15.4796C5.47266 15.0654 5.80844 14.7296 6.22266 14.7296Z" fill="#E26CF4"></path>
    </g>
    <defs>
      <clipPath id=":rg9:">
          <rect width="16.8421" height="24" fill="white" transform="translate(3.97266 0.970215)"></rect>
      </clipPath></defs>
  </svg>
)

const EventIcon = () => (
  <svg width="21" height="21" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clip-path="url(#:rgg:)">
      <path d="M12.788 3.96973H7.81887C7.59378 3.96973 7.39643 4.12014 7.33676 4.33718L5.41219 11.3372C5.32468 11.6555 5.56419 11.9697 5.8943 11.9697H8.32037L7.95957 17.7677C7.94134 18.0607 8.3112 18.2028 8.49384 17.9731L15.0056 9.78085C15.266 9.45322 15.0327 8.96973 14.6142 8.96973H12.108L13.2712 4.5983C13.3556 4.28094 13.1164 3.96973 12.788 3.96973Z" fill="#F2BA2A"></path>
    </g>
    <defs>
      <clipPath id=":rgg:">
          <rect width="16" height="16" fill="white" transform="translate(2.39453 2.97021)"></rect>
      </clipPath>
    </defs>
  </svg>
)

const renderLuaTypes = (items) => {
  if (!items || items.length === 0) {
    return <span className={styles.summaryMuted}>()</span>
    // Was debating either `nil` or just `()`
  }
  // No brackets..
  if (items.length === 1) {
    return <LuaType code={items[0].lua_type} />
  }  

  // TODO:
  // Representation of multiple types looks a bit scuffed with the spacing
  // And long types arent encased in a single code block, they have multiple inside a span
  // Which doesnt look right
  return (
    <>
      <span>(</span>
      {items.map((item, index) => (
        <span key={`${item.lua_type}-${index}`}>
          <LuaType code={item.lua_type} />
          {index !== items.length - 1 && <span>, </span>}
        </span>
      ))}
      <span>)</span>
    </>
  )
}

const renderParams = (params) => {
  if (!params || params.length === 0) {
    return <span className={styles.summaryMuted}>()</span>
  }

  return (
    <>
      <span>(</span>
      {params.map((param, index) => (
        <span key={`${param.name}-${index}`}>
          <span>{param.name}: </span>
          <LuaType code={param.lua_type} />
          {index !== params.length - 1 && <span>, </span>}
        </span>
      ))}
      <span>)</span>
    </>
  )
}

const getDeprecatedDescription = (deprecated) => {
  const lines = []

  if (deprecated.desc) {
    lines.push(`Reason: ${deprecated.desc}`)
  }

  if (deprecated.version) {
    lines.push(`Deprecated in ${deprecated.version}`)
  }

  return lines.join("\n")
}

const SummaryTable = ({ title, icon: Icon, members, luaClassName, kind }) => {
  if (members.length === 0) {
    return null
  }

  const memberDisplayName = (member) =>
    member.name === "__call" ? `${luaClassName}()` : member.name

  const shouldRenderTag = (tag) => kind !== "events" || tag !== "Signal"

  const renderSignature = (member) => {
    if (kind === "properties") {
      return (
        <>
          <span className={styles.summaryMemberSep}>:</span>
          <LuaType code={member.lua_type} />
        </>
      )
    }

    return (
      <>
        <span className={styles.summaryMemberSep}>{renderParams(member.params)}</span>
        <span className={styles.summaryMemberSep}>:</span>
        <span>{renderLuaTypes(member.returns || [])}</span>
      </>
    )
  }

  const renderMemberChips = (member) => {
    const tags = (member.tags || []).filter(shouldRenderTag)

    return (
      <div className={styles.summaryChipsCell}>
        {member.yields && (
          <Badge label="Yields" muted className={styles.summaryBadge} />
        )}
        {member.readonly && (
          <Badge label="Read Only" muted className={styles.summaryBadge} />
        )}
        {(member.realm || []).map((realm) => (
          <Badge key={realm} label={realm} muted className={styles.summaryBadge} />
        ))}
        {tags.map((tag) => (
          <span key={tag} className={styles.summaryTextChip}>
            {tag}
          </span>
        ))}
        {member.deprecated && (
          <Badge
            label="Deprecated"
            muted
            className={`${styles.summaryBadge} ${styles.summaryDeprecatedBadge}`}
            title="This item is no longer supported."
            description={getDeprecatedDescription(member.deprecated)}
          />
        )}
      </div>
    )
  }

  return (
    <section className={styles.summarySection}>
      <Heading as="h3">{title}</Heading>
      <div className={styles.summaryList}>
        {members.map((member) => (
          <div
            key={`${kind}-${member.name}`}
            className={`${styles.summaryRow} ${
              member.deprecated ? styles.summaryRowDeprecated : ""
            }`}
          >
            <div className={styles.summaryRowMain}>
              <span className={styles.summaryIcon}>
                <Icon />
              </span>
              <div className={styles.summaryMemberText}>
                <a href={`#${member.name}`} className={styles.summaryName}>
                  <span
                    className={styles.summaryMemberName}
                    style={{
                      textDecoration: member.deprecated ? "line-through" : "none",
                    }}
                  >
                    {memberDisplayName(member)}
                  </span>
                </a>
                <span className={styles.summarySignature}>{renderSignature(member)}</span>
              </div>
            </div>
            {renderMemberChips(member)}
          </div>
        ))}
      </div>
    </section>
  )
}

export default function SummarySection({ luaClass }) {
  const properties = luaClass.properties || []
  const functions = (luaClass.functions || []).filter(
    (member) => !member.tags?.includes("Signal")
  )
  const events = (luaClass.functions || []).filter((member) =>
    member.tags?.includes("Signal")
  )

  const sections = [
    { title: "Properties", icon: PropertyIcon, members: properties, kind: "properties" },
    { title: "Functions", icon: FunctionIcon, members: functions, kind: "functions" },
    { title: "Events", icon: EventIcon, members: events, kind: "events" },
  ].filter((section) => section.members.length > 0)

  if (sections.length === 0) {
    return null
  }

  return (
    <section className={styles.summaryContainer}>
      <Heading as="h2" id="summary">
        Summary
      </Heading>
      {sections.map((section) => (
        <SummaryTable
          key={section.title}
          title={section.title}
          icon={section.icon}
          members={section.members}
          luaClassName={luaClass.name}
          kind={section.kind}
        />
      ))}
    </section>
  )
}