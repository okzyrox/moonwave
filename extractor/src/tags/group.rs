use serde::Serialize;

use crate::{diagnostic::Diagnostic, span::Span};

fn parse_group_path<'a>(span: Span<'a>) -> Result<(Option<Span<'a>>, Span<'a>), Diagnostic> {
    let trimmed = span.trim();
    let mut parent = None;
    let mut name = trimmed;

    for separator in [" > ", " / ", "::", ">", "/"] {
        // Works-ish
        if let Some(separator_index) = trimmed.as_str().find(separator) {
            let parent_len = separator_index;
            let name_start = separator_index + separator.len();

            parent = Some(trimmed.slice(0, parent_len).trim());
            name = trimmed.slice(name_start, trimmed.len() - name_start).trim();
            break;
        }
    }

    if name.as_str().contains('>')
        || name.as_str().contains('/')
        || name.as_str().contains("::")
    {
        return Err(span.diagnostic(
            "@group only supports a parent group and a child group",
        ));
    }

    if name.as_str().is_empty() {
        return Err(span.diagnostic("@group must have a non-empty group name"));
    }

    if let Some(parent) = parent {
        if parent.as_str().is_empty() {
            return Err(span.diagnostic("@group must have a non-empty parent group name"));
        }
    }

    Ok((parent, name))
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct GroupTag<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<Span<'a>>,
    pub name: Span<'a>,
    #[serde(skip)]
    pub source: Span<'a>,
}

impl<'a> GroupTag<'a> {
    pub fn parse(span: Span<'a>) -> Result<Self, Diagnostic> {
        let (parent, name) = parse_group_path(span)?;

        Ok(Self {
            parent,
            name,
            source: span,
        })
    }
}

#[derive(Debug, PartialEq, Serialize, Clone)]
pub struct GroupDescriptionTag<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent: Option<Span<'a>>,
    pub name: Span<'a>,
    #[serde(skip)]
    pub source: Span<'a>,
}

impl<'a> GroupDescriptionTag<'a> {
    pub fn parse(span: Span<'a>) -> Result<Self, Diagnostic> {
        let (parent, name) = parse_group_path(span)?;

        Ok(Self {
            parent,
            name,
            source: span,
        })
    }
}