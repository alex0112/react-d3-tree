import React, { PropTypes } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { layout, behavior, event, select } from 'd3';
import clone from 'clone';
import uuid from 'uuid';

import Node from '../Node';
import Link from '../Link';
import './style.css';

export default class Tree extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      initialRender: true,
      data: this.assignInternalProperties(clone(this.props.data)),
      zoom: undefined,
    };
    this.findNodesById = this.findNodesById.bind(this);
    this.collapseNode = this.collapseNode.bind(this);
    this.handleNodeToggle = this.handleNodeToggle.bind(this);
  }

  componentDidMount() {
    this.bindZoomListener();

    // TODO find better way of setting initialDepth, re-render here is suboptimal
    this.setState({ initialRender: false }); // eslint-disable-line
  }

  componentWillReceiveProps(nextProps) {
    // Clone new data & assign internal properties
    if (this.props.data !== nextProps.data) {
      this.setState({
        data: this.assignInternalProperties(clone(nextProps.data)),
      });
    }
  }


  /**
   * setInitialTreeDepth - Description
   *
   * @param {array} nodeSet Array of nodes generated by `generateTree`
   * @param {number} initialDepth Maximum initial depth the tree should render
   *
   * @return {void}
   */
  setInitialTreeDepth(nodeSet, initialDepth) {
    nodeSet.forEach((n) => {
      n._collapsed = n.depth >= initialDepth;
    });
  }


  /**
   * bindZoomListener - If `props.zoomable`, binds a listener for
   * "zoom" events to the SVG and sets scaleExtent to min/max
   * specified in `props.scaleExtent`.
   *
   * @return {void}
   */
  bindZoomListener() {
    const { zoomable, scaleExtent } = this.props;
    const svg = select('.svg');

    if (zoomable) {
      this.setState({ zoom: 'scale(1)' });
      svg.call(behavior.zoom()
        .scaleExtent([scaleExtent.min, scaleExtent.max])
        .on('zoom', () => {
          this.setState({ zoom: `scale(${event.scale})` });
        })
      );
    }
  }


  /**
   * assignInternalProperties - Assigns internal properties to each node in the
   * `data` set that are required for tree manipulation and returns
   * a new `data` array.
   *
   * @param {array} data Hierarchical tree data
   *
   * @return {array} `data` array with internal properties added
   */
  assignInternalProperties(data) {
    return data.map((node) => {
      node.id = uuid.v4();
      node._collapsed = false;
      // if there are children, recursively assign properties to them too
      if (node.children && node.children.length > 0) {
        node.children = this.assignInternalProperties(node.children);
        node._children = node.children;
      }
      return node;
    });
  }


  /**
   * findNodesById - Description
   *
   * @param {string} nodeId The `node.id` being searched for
   * @param {array} nodeSet Array of `node` objects
   * @param {array} hits Accumulator for matches, passed between recursive calls
   *
   * @return {array} Set of nodes matching `nodeId`
   */
   // TODO Refactor this into a more readable/reasonable recursive depth-first walk.
  findNodesById(nodeId, nodeSet, hits) {
    if (hits.length > 0) {
      return hits;
    }

    hits = hits.concat(nodeSet.filter((node) => node.id === nodeId));

    nodeSet.forEach((node) => {
      if (node._children && node._children.length > 0) {
        hits = this.findNodesById(nodeId, node._children, hits);
        return hits;
      }
      return hits;
    });

    return hits;
  }


  /**
   * collapseNode - Recursively sets the `_collapsed` property of
   * the passed `node` object and its children to `true`.
   *
   * @param {object} node Node object with custom properties
   *
   * @return {void}
   */
  collapseNode(node) {
    node._collapsed = true;
    if (node._children && node._children.length > 0) {
      node._children.forEach((child) => {
        this.collapseNode(child);
      });
    }
  }


  /**
   * expandNode - Sets the `_collapsed` property of
   * the passed `node` object to `false`.
   *
   * @param {type} node Node object with custom properties
   *
   * @return {void}
   */
  expandNode(node) {
    node._collapsed = false;
  }


  /**
   * handleNodeToggle - Finds the node matching `nodeId` and
   * expands/collapses it, depending on the current state of
   * its `_collapsed` property.
   *
   * @param {string} nodeId A node object's `id` field.
   *
   * @return {void}
   */
  handleNodeToggle(nodeId) {
    if (this.props.collapsible) {
      const data = clone(this.state.data);
      const matches = this.findNodesById(nodeId, data, []);
      const targetNode = matches[0];
      targetNode._collapsed
        ? this.expandNode(targetNode)
        : this.collapseNode(targetNode);
      this.setState({ data });
    }
  }


  /**
   * generateTree - Generates tree elements (`nodes` and `links`) by
   * grabbing the rootNode from `this.state.data[0]`.
   * Restricts tree depth to `props.initial` if defined and this is
   * the initial render of the tree.
   *
   * @return {object} Object containing `nodes` and `links` fields.
   */
  generateTree() {
    const { initialDepth } = this.props;
    const tree = layout.tree()
      .nodeSize([100 + 40, 100 + 40])
      .separation((d) => d._children ? 1.2 : 0.9)
      .children((d) => d._collapsed ? null : d._children);

    const rootNode = this.state.data[0];
    const nodes = tree.nodes(rootNode);
    const links = tree.links(nodes);

    // set `initialDepth` on first render if specified
    if (initialDepth !== undefined && this.state.initialRender) {
      this.setInitialTreeDepth(nodes, initialDepth);
    }

    return { nodes, links };
  }

  render() {
    const { orientation, translate, pathFunc, depthFactor } = this.props;
    const { nodes, links } = this.generateTree();
    return (
      <div className="treeContainer">
        <svg width="100%" height="100%">
          <TransitionGroup
            component="g"
            transform={`translate(${translate.x},${translate.y})`}
          >
            {nodes.map((nodeData) =>
              <Node
                key={nodeData.id}
                orientation={orientation}
                depthFactor={depthFactor}
                textAnchor="start"
                nodeData={nodeData}
                primaryLabel={nodeData.name}
                secondaryLabels={nodeData.attributes}
                onClick={this.handleNodeToggle}
              />
            )}

            {links.map((linkData) =>
              <Link
                key={uuid.v4()}
                orientation={orientation}
                pathFunc={pathFunc}
                linkData={linkData}
              />
            )}
          </TransitionGroup>
        </svg>
      </div>
    );
  }
}

Tree.defaultProps = {
  orientation: 'horizontal',
  translate: { x: 0, y: 0 },
  pathFunc: 'diagonal',
  depthFactor: undefined,
  collapsible: true,
  initialDepth: undefined,
  zoomable: true,
  scaleExtent: { min: 0.1, max: 1 },
};

Tree.propTypes = {
  data: PropTypes.array.isRequired,
  orientation: PropTypes.oneOf([
    'horizontal',
    'vertical',
  ]),
  translate: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  pathFunc: PropTypes.oneOf([
    'diagonal',
    'elbow',
  ]),
  depthFactor: PropTypes.number,
  collapsible: PropTypes.bool,
  initialDepth: PropTypes.number,
  zoomable: PropTypes.bool,
  scaleExtent: PropTypes.shape({
    min: PropTypes.number,
    max: PropTypes.number,
  }),
};
